
from __future__ import annotations
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from core.auth import verify_api_key
from core.database import get_db
from models.models import CloudResource, CostHistory, Recommendation, AnomalyRecord

router = APIRouter(prefix="/api", tags=["Exports"])

@router.post("/export/pdf", dependencies=[Depends(verify_api_key)])
def export_pdf(db: Session = Depends(get_db)):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer,
            Table, TableStyle, HRFlowable, KeepTogether
        )

        resources    = db.query(CloudResource).all()
        recs         = db.query(Recommendation).order_by(Recommendation.priority).all()
        anomalies    = db.query(AnomalyRecord).limit(10).all()
        cost_history = db.query(CostHistory).order_by(CostHistory.date.desc()).limit(7).all()

        total_cost  = round(sum(r.monthly_cost or 0 for r in resources), 2)
        total_savings = round(sum(r.estimated_savings or 0 for r in recs), 2)
        idle_count  = sum(1 for r in resources if r.status == "Idle")
        over_count  = sum(1 for r in resources if r.status == "Over-Utilized")
        healthy     = len(resources) - idle_count - over_count
        sorted_res  = sorted(resources, key=lambda r: r.monthly_cost or 0, reverse=True)

        buf  = io.BytesIO()
        doc  = SimpleDocTemplate(buf, pagesize=A4,
                                 leftMargin=1.5*cm, rightMargin=1.5*cm,
                                 topMargin=1.8*cm, bottomMargin=1.8*cm)
        styles = getSampleStyleSheet()
        story  = []

        TITLE_STYLE = ParagraphStyle("TitleStyle", parent=styles["Title"],
                             fontSize=20, textColor=colors.HexColor("#0f172a"),
                             fontName="Helvetica-Bold", spaceAfter=2, alignment=0)
        SUBTITLE_STYLE = ParagraphStyle("SubTitleStyle", parent=styles["Normal"],
                              fontSize=10, textColor=colors.HexColor("#64748b"),
                              fontName="Helvetica", spaceAfter=6)
        H2 = ParagraphStyle("H2", parent=styles["Heading2"],
                             fontSize=12, textColor=colors.HexColor("#0284c7"),
                             fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6)
        CELL_HEADER = ParagraphStyle("CellHeader", parent=styles["Normal"],
                                  fontSize=9, textColor=colors.HexColor("#ffffff"),
                                  fontName="Helvetica-Bold")
        CELL_BODY = ParagraphStyle("CellBody", parent=styles["Normal"],
                                fontSize=8, textColor=colors.HexColor("#334155"),
                                fontName="Helvetica")
        CELL_BODY_BOLD = ParagraphStyle("CellBodyBold", parent=styles["Normal"],
                                    fontSize=8, textColor=colors.HexColor("#0f172a"),
                                    fontName="Helvetica-Bold")
        
        generated = datetime.now(timezone.utc).strftime("%B %d, %Y - %H:%M UTC")

        story.append(Paragraph("CloudIQ Infrastructure & Resource Audit Report", TITLE_STYLE))
        story.append(Paragraph(f"Generated On: {generated}  |  Environment: Production Cloud Telemetry", SUBTITLE_STYLE))
        story.append(HRFlowable(width="100%", thickness=1.5,
                                color=colors.HexColor("#0284c7"), spaceAfter=10))

        story.append(Paragraph("1. Executive Posture Summary", H2))
        summary_rows = [
            [Paragraph("Executive Metric", CELL_HEADER), Paragraph("Current System Status", CELL_HEADER)],
            [Paragraph("Total Resources Scanned", CELL_BODY), Paragraph(str(len(resources)), CELL_BODY_BOLD)],
            [Paragraph("Healthy Workloads", CELL_BODY), Paragraph(f"{healthy} / {len(resources)} ({(healthy/max(len(resources),1)*100):.0f}%)", CELL_BODY)],
            [Paragraph("Idle Resources (Waste Candidates)", CELL_BODY), Paragraph(str(idle_count), CELL_BODY_BOLD)],
            [Paragraph("Over-Utilized Resources (Performance Risks)", CELL_BODY), Paragraph(str(over_count), CELL_BODY_BOLD)],
            [Paragraph("Total Monthly Spend", CELL_BODY), Paragraph(f"${total_cost:,.2f}", CELL_BODY_BOLD)],
            [Paragraph("Modeled Potential Monthly Savings", CELL_BODY), Paragraph(f"${total_savings:,.2f}", CELL_BODY_BOLD)],
        ]
        story.append(_make_table(summary_rows, col_widths=[220, 280], is_header=True))
        story.append(Spacer(1, 0.3*cm))

        story.append(Paragraph("2. Complete Cloud Resource Inventory", H2))
        res_rows = [
            [Paragraph("Name", CELL_HEADER), Paragraph("Type", CELL_HEADER), Paragraph("Region", CELL_HEADER), Paragraph("Status", CELL_HEADER), Paragraph("CPU%", CELL_HEADER), Paragraph("Cost ($/mo)", CELL_HEADER)]
        ]
        for r in sorted_res:
            res_rows.append([
                Paragraph(r.name, CELL_BODY_BOLD),
                Paragraph(r.resource_type, CELL_BODY),
                Paragraph(r.region, CELL_BODY),
                Paragraph(r.status, CELL_BODY),
                Paragraph(f"{round(r.cpu_usage or 0, 1)}%", CELL_BODY),
                Paragraph(f"${r.monthly_cost:,.2f}", CELL_BODY_BOLD)
            ])
        story.append(_make_table(res_rows, col_widths=[120, 90, 80, 80, 50, 80], is_header=True))
        story.append(Spacer(1, 0.3*cm))

        if recs:
            story.append(Paragraph("3. Recommended Optimization Actions", H2))
            rec_rows = [
                [Paragraph("Priority", CELL_HEADER), Paragraph("Resource Target", CELL_HEADER), Paragraph("Action Plan", CELL_HEADER), Paragraph("Est. Monthly Savings", CELL_HEADER)]
            ]
            for r in recs[:8]:
                savings = f"${r.estimated_savings:,.2f}" if r.estimated_savings else "-"
                rec_rows.append([
                    Paragraph(r.priority, CELL_BODY_BOLD),
                    Paragraph(r.resource_name, CELL_BODY_BOLD),
                    Paragraph(r.action[:80], CELL_BODY),
                    Paragraph(savings, CELL_BODY_BOLD)
                ])
            story.append(_make_table(rec_rows, col_widths=[60, 110, 230, 100], is_header=True))
            story.append(Spacer(1, 0.3*cm))

        if cost_history:
            story.append(Paragraph("4. Recent Daily Spend Motion (Last 7 Days)", H2))
            hist_rows = [
                [Paragraph("Date", CELL_HEADER), Paragraph("Daily Spend ($)", CELL_HEADER), Paragraph("Anomaly Status", CELL_HEADER)]
            ]
            for ch in reversed(cost_history):
                hist_rows.append([
                    Paragraph(ch.date, CELL_BODY),
                    Paragraph(f"${ch.daily_cost:,.2f}", CELL_BODY_BOLD),
                    Paragraph("Cost Spike Anomaly" if ch.is_anomaly else "Normal", CELL_BODY)
                ])
            story.append(_make_table(hist_rows, col_widths=[150, 170, 180], is_header=True))

        doc.build(story)
        buf.seek(0)
        return Response(
            content=buf.read(),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=CloudIQ_Resource_Report.pdf"},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

def _make_table(data: list, col_widths=None, is_header=True):
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib import colors

    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    style = TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0),  colors.HexColor("#0f172a")),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  colors.HexColor("#ffffff")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("GRID",        (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
    ])
    t.setStyle(style)
    return t

@router.post("/export/xlsx", dependencies=[Depends(verify_api_key)])
def export_xlsx(db: Session = Depends(get_db)):
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        resources    = db.query(CloudResource).all()
        cost_history = db.query(CostHistory).order_by(CostHistory.date).all()
        recs         = db.query(Recommendation).all()
        anomalies    = db.query(AnomalyRecord).all()

        wb = openpyxl.Workbook()

        HDR_FILL  = PatternFill("solid", fgColor="0D2137")
        HDR_FONT  = Font(bold=True, color="63B2FF", size=10)
        EVEN_FILL = PatternFill("solid", fgColor="0A1628")
        ODD_FILL  = PatternFill("solid", fgColor="0D1F38")
        DATA_FONT = Font(color="94A3B8", size=9)
        CENTER    = Alignment(horizontal="center", vertical="center", wrap_text=True)
        THIN_BORDER = Border(
            left=Side(style="thin", color="1E3A5F"),
            right=Side(style="thin", color="1E3A5F"),
            top=Side(style="thin", color="1E3A5F"),
            bottom=Side(style="thin", color="1E3A5F"),
        )

        def write_sheet(ws, headers, rows):
            ws.append(headers)
            for col_num, _ in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col_num)
                cell.fill   = HDR_FILL
                cell.font   = HDR_FONT
                cell.alignment = CENTER
                cell.border = THIN_BORDER
                ws.column_dimensions[get_column_letter(col_num)].width = 18
            for r_idx, row in enumerate(rows, 2):
                ws.append(row)
                fill = EVEN_FILL if r_idx % 2 == 0 else ODD_FILL
                for c_idx in range(1, len(row) + 1):
                    cell = ws.cell(row=r_idx, column=c_idx)
                    cell.fill   = fill
                    cell.font   = DATA_FONT
                    cell.border = THIN_BORDER

        ws1 = wb.active
        ws1.title = "Resources"
        write_sheet(ws1,
            ["Name", "UID", "Type", "Provider", "Region", "Status",
             "CPU%", "Mem%", "Monthly Cost ($)", "Risk Score", "Public"],
            [[r.name, r.resource_uid, r.resource_type, r.provider, r.region,
              r.status, round(r.cpu_usage or 0, 1), round(r.memory_usage or 0, 1),
              round(r.monthly_cost or 0, 2), round(r.risk_score or 0, 2),
              "Yes" if r.public_access else "No"] for r in resources]
        )

        ws2 = wb.create_sheet("Cost History")
        write_sheet(ws2,
            ["Date", "Daily Cost ($)", "Anomaly"],
            [[ch.date, round(ch.daily_cost, 2),
              "Yes" if ch.is_anomaly else "No"] for ch in cost_history]
        )

        ws3 = wb.create_sheet("Recommendations")
        write_sheet(ws3,
            ["Resource", "Action", "Priority", "Category", "Est. Savings ($)", "Reason"],
            [[r.resource_name, r.action, r.priority, r.category or "cost",
              round(r.estimated_savings or 0, 2), r.reason] for r in recs]
        )

        if anomalies:
            ws4 = wb.create_sheet("Anomalies")
            write_sheet(ws4,
                ["Resource ID", "Type", "Z-Score", "Deviation", "Severity", "Description", "Detected At"],
                [[a.resource_id, a.anomaly_type,
                  round(a.z_score or 0.0, 2),
                  round(a.deviation or 0.0, 2),
                  a.severity or "medium",
                  a.description or "",
                  str(a.created_at or "")
                  ] for a in anomalies]
            )

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return Response(
            content=buf.read(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=cloudiq_export.xlsx"},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {str(e)}")
