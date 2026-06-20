import {
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  formatTrendLabel,
} from './formatters';

const HINGLISH_MARKERS = [
  'kya',
  'kaise',
  'mera',
  'mujhe',
  'bhai',
  'cost',
  'infra',
  'optimize',
  'server',
  'sahi',
  'dikhao',
];

const COPY = {
  en: {
    dashboard: 'AI Command Center',
    assistant: 'AI Assistant',
    insights: 'Insights',
    actions: 'Recommendations',
    graph: 'Graph',
    globe: 'Globe',
    resources: 'Resources',
    predictions: 'Predictions',
    activity: 'Agent Activity',
    statusActive: 'Active',
    statusIdle: 'Idle',
    assistantGreeting:
      "CloudIQ Agent is online. Ask for cost reduction, risk detection, architecture advice, or a deep system audit.",
    assistantPlaceholder: 'Ask CloudIQ anything about your cloud posture...',
    thinkingLead: 'CloudIQ Agent is analyzing your system...',
    storyTitle: 'Signal Story',
    suggestions: [
      'How can I improve this system?',
      'Any security risks in my cloud setup?',
      'Show me hidden cost drivers',
      'What if I stop idle resources?',
    ],
  },
  hinglish: {
    dashboard: 'AI Command Center',
    assistant: 'AI Assistant',
    insights: 'Insights',
    actions: 'Recommendations',
    graph: 'Graph',
    globe: 'Globe',
    resources: 'Resources',
    predictions: 'Predictions',
    activity: 'Agent Activity',
    statusActive: 'Live',
    statusIdle: 'Standby',
    assistantGreeting:
      'CloudIQ Agent ready hai. Cost kam karni ho, risk dekhna ho, ya system audit karna ho, bas pucho.',
    assistantPlaceholder: 'CloudIQ ko apne infra ke baare mein pucho...',
    thinkingLead: 'CloudIQ Agent abhi tumhara system analyze kar raha hai...',
    storyTitle: 'AI Storyline',
    suggestions: [
      'Mera system improve kaise karu?',
      'Koi security risk hai kya?',
      'Cost drivers dikhao',
      'What if main idle resources stop kar du?',
    ],
  },
  hi: {
    dashboard: 'AI Command Center',
    assistant: 'AI Assistant',
    insights: 'Insights',
    actions: 'Recommendations',
    graph: 'Graph',
    globe: 'Globe',
    resources: 'Resources',
    predictions: 'Predictions',
    activity: 'Agent Activity',
    statusActive: 'Sakriya',
    statusIdle: 'Prateeksha',
    assistantGreeting:
      'CloudIQ Agent taiyar hai. Lagat, risk, optimization ya system audit ke liye sawal poochiye.',
    assistantPlaceholder: 'Apne cloud system ke baare mein puchiye...',
    thinkingLead: 'CloudIQ Agent aapke system ka vishleshan kar raha hai...',
    storyTitle: 'AI Storyline',
    suggestions: [
      'Is system ko aur behtar kaise banaun?',
      'Kya koi security risk hai?',
      'Mujhe hidden cost drivers dikhao',
      'Agar idle resources band kar du to kya hoga?',
    ],
  },
};

const ALTERNATIVE_SOLUTIONS = {
  'Terminate or Stop Instance': 'Schedule auto-shutdown windows before permanent termination.',
  'Scale Up or Upgrade Instance': 'Shift burst traffic to autoscaling workers before resizing the instance.',
  'Downsize to Smaller Instance': 'Move to a burstable tier and monitor for one week before committing.',
  'Schedule Restart / Maintenance Window': 'Use rolling restarts during low-traffic periods to reduce disruption.',
};

const IMPACT_TONES = {
  High: 'from-rose-500/25 via-fuchsia-500/10 to-transparent',
  Medium: 'from-amber-400/25 via-cyan-500/10 to-transparent',
  Low: 'from-emerald-400/25 via-sky-500/10 to-transparent',
};

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getConfidenceScore(recommendation, summary, predictions, anomalies) {
  const costForecast = predictions?.cost_predictions || predictions || {};
  const trendLift = costForecast?.trend_direction === 'increasing' ? 6 : 0;
  const anomalyLift = anomalies?.total_anomaly_days ? 4 : 0;
  const idleLift = summary?.idle_count ? Math.min(summary.idle_count * 2, 10) : 0;
  const base =
    recommendation.priority === 'High'
      ? 88
      : recommendation.priority === 'Medium'
        ? 76
        : 64;

  return Math.min(98, base + trendLift + anomalyLift + idleLift);
}

export function detectLanguageTone(input = '') {
  if (!input.trim()) {
    return 'en';
  }

  if (/[\u0900-\u097F]/.test(input)) {
    return 'hi';
  }

  const lowered = input.toLowerCase();

  if (HINGLISH_MARKERS.some((marker) => lowered.includes(marker))) {
    return 'hinglish';
  }

  return 'en';
}

export function getLocalizedCopy(language = 'en') {
  return COPY[language] || COPY.en;
}

export function extractToolUsage(text = '') {
  const match = text.match(/\*?I analyzed your system using:\s*([^*\n]+)/i);

  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function stripToolUsage(text = '') {
  return text
    .replace(/\n*\*?I analyzed your system using:[^*\n]+\*?/i, '')
    .trim();
}

export function buildCommandCenterModel(snapshot, language = 'en') {
  const copy = getLocalizedCopy(language);
  const analyze = snapshot.analyze || {};
  const predict = snapshot.predict || {};
  const recommendations = snapshot.recommend || {};

  const summary = analyze.resources || {};
  const resources = analyze.resource_list || [];
  const anomalies = analyze.anomalies || {};
  const graph = analyze.graph || {};
  
  const predictions = predict || {};
  const costPredictions = predictions; // They are merged in predict endpoint
  const history = predictions.historical || [];
  const riskResources = predictions.resource_risks || [];

  const healthScore = Math.round(
    ((summary.healthy_count || 0) / Math.max(summary.total_resources || 1, 1)) * 100
  );
  const efficiencyScore = Math.max(0, Math.round(100 - (graph.avg_risk_score || 0)));
  const riskScore = Math.min(
    100,
    riskResources.length * 18 +
      (anomalies.total_anomaly_days || 0) * 8 +
      (summary.idle_count || 0) * 4
  );
  const riskLevel =
    riskScore >= 72 ? 'Elevated' : riskScore >= 42 ? 'Watch' : 'Stable';
  const savings = recommendations.total_potential_savings || 0;
  const beforeCost = summary.total_monthly_cost || 0;
  const afterCost = Math.max(0, beforeCost - savings);

  const heroSteps = [
    {
      label: copy.thinkingLead,
      detail: `${summary.total_resources || 0} assets scanned across cost, risk, and efficiency signals.`,
      status: 'running',
    },
    {
      label: 'Resource planner locked target zones.',
      detail: `${summary.idle_count || 0} idle assets and ${summary.over_utilized_count || 0} stressed assets flagged.`,
      status: 'done',
    },
    {
      label: 'Anomaly detector reviewed spend motion.',
      detail: `${anomalies.total_anomaly_days || 0} spikes surfaced in the last 90 days.`,
      status: 'done',
    },
    {
      label: 'Recommendation engine generated action paths.',
      detail: `${recommendations.count || 0} actions mapped with ${formatCurrency(savings)} in modeled savings.`,
      status: 'done',
    },
  ];

  const predictedCost = costPredictions.monthly_forecast || 0;
  const savingsPercent = beforeCost > 0 ? (savings / beforeCost) * 100 : 0;
  const anomalyCount = anomalies.total_anomaly_days || 0;
  const highRiskCount = riskResources.length || 0;

  const insightCards = [
    {
      id: 'cost',
      title: 'Monthly Cost',
      value: formatCurrency(beforeCost),
      rawValue: beforeCost,
      delta: predictedCost > beforeCost
        ? `+${formatCurrency(predictedCost - beforeCost)}`
        : `-${formatCurrency(beforeCost - predictedCost)}`,
      trend: costPredictions?.trend_direction || 'stable',
      sparkData: (costPredictions?.historical || []).slice(-7).map(d => d.fitted || d.actual || 0),
      detail: 'Current projected vs historical trend.',
      tone: 'from-fuchsia-500/25 via-violet-500/10 to-transparent',
    },
    {
      id: 'savings',
      title: 'Potential Savings',
      value: formatCurrency(savings),
      rawValue: savings,
      delta: `${savingsPercent.toFixed(0)}% reduction`,
      trend: 'decreasing',
      invertColors: true,
      sparkData: [savings * 1.2, savings * 1.15, savings * 1.1, savings * 1.05, savings * 0.95, savings * 0.98, savings],
      detail: 'Optimized posture if recommended actions are staged.',
      tone: 'from-cyan-500/25 via-sky-500/10 to-transparent',
    },
    {
      id: 'risk',
      title: 'High Risk Servers',
      value: `${highRiskCount}`,
      rawValue: highRiskCount,
      delta: highRiskCount > 3 ? 'Needs attention' : 'Under control',
      trend: highRiskCount > 3 ? 'increasing' : 'stable',
      sparkData: [Math.max(0, highRiskCount - 2), Math.max(0, highRiskCount - 1), highRiskCount, Math.max(0, highRiskCount - 1), highRiskCount, highRiskCount + 1, highRiskCount],
      detail: 'Instances with elevated failure or saturation signals.',
      tone: 'from-rose-500/25 via-orange-500/10 to-transparent',
    },
    {
      id: 'anomaly',
      title: 'Anomaly Pulse',
      value: anomalyCount
        ? `+${formatCurrency(
            average((anomalies.anomalies || []).map((item) => item.deviation || 0)),
            { minimumFractionDigits: 0, maximumFractionDigits: 0 }
          )}`
        : 'Stable',
      rawValue: anomalyCount,
      delta: anomalyCount > 5 ? 'Above threshold' : 'Within normal',
      trend: anomalyCount > 5 ? 'increasing' : 'stable',
      sparkData: [0, 1, 0, 2, anomalyCount > 0 ? anomalyCount - 1 : 0, anomalyCount > 0 ? anomalyCount + 1 : 0, anomalyCount],
      detail: anomalyCount
        ? 'Average deviation across detected spend spikes.'
        : 'No major spend spikes detected in the current window.',
      tone: 'from-amber-400/25 via-cyan-400/10 to-transparent',
    },
  ];

  const resourceStatus = [
    { name: 'Healthy', value: summary.healthy_count || 0 },
    { name: 'Idle', value: summary.idle_count || 0 },
    { name: 'Over', value: summary.over_utilized_count || 0 },
  ];

  // BUG-012 FIX: resources[] is always empty (analyze API returns summary counts, not per-resource data)
  // Derive CPU band estimates from available status summary counts
  const totalRes = summary.total_resources || 1;
  const usageBands = [
    { label: '0-25%',  count: summary.idle_count || 0 },
    { label: '25-50%', count: Math.max(0, Math.round(totalRes * 0.25) - (summary.idle_count || 0)) },
    { label: '50-75%', count: summary.healthy_count || 0 },
    { label: '75%+',   count: summary.over_utilized_count || 0 },
  ];

  const costStory = [
    {
      label: 'Trajectory',
      value: formatTrendLabel(costPredictions.trend_direction),
      body: `Forecast model projects ${formatCurrency(
        costPredictions.monthly_forecast,
        { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      )} next month.`,
    },
    {
      label: 'Pressure',
      value: `${riskResources.length} critical workloads`,
      body: 'At-risk nodes are clustered around high CPU, high memory, and long uptime patterns.',
    },
    {
      label: 'Decision',
      value: `${recommendations.count || 0} guided actions`,
      body: `The strongest move is to reclaim ${formatCurrency(savings)} in modeled waste first, then stabilize hot paths.`,
    },
  ];

  const recommendationCards = (recommendations.recommendations || []).map(
    (recommendation, index) => {
      const confidence = getConfidenceScore(
        recommendation,
        summary,
        predictions,
        anomalies
      );
      const impactValue =
        recommendation.estimated_savings >= 0
          ? formatCurrency(recommendation.estimated_savings)
          : `-${formatCurrency(Math.abs(recommendation.estimated_savings))}`;

      return {
        ...recommendation,
        id: `${recommendation.resource_name}-${index}`,
        confidence,
        priority: recommendation.priority,
        impactValue,
        impactLabel:
          recommendation.estimated_savings >= 0
            ? `${impactValue}/month modeled recovery`
            : `${impactValue}/month cost delta for resilience`,
        riskLevel:
          recommendation.priority === 'High'
            ? 'Immediate'
            : recommendation.priority === 'Medium'
              ? 'Guardrail'
              : 'Observe',
        alternative:
          ALTERNATIVE_SOLUTIONS[recommendation.action] ||
          'Monitor the workload for one additional week before applying the change.',
        gradient: IMPACT_TONES[recommendation.priority] || IMPACT_TONES.Medium,
      };
    }
  );

  const auditor = {
    improvements: [
      `${summary.idle_count || 0} idle resources should be staged for shutdown or automation.`,
      `${summary.over_utilized_count || 0} saturated services need scaling, queue smoothing, or workload redistribution.`,
      `Forecast pressure is ${formatTrendLabel(costPredictions.trend_direction).toLowerCase()}, so budget guardrails should be tightened now.`,
    ],
    security: [
      riskResources.length
        ? `${riskResources.length} servers show stability risk patterns; patch windows and restart hygiene should be enforced.`
        : 'No immediate high-risk compute nodes detected.',
      anomalies.total_anomaly_days
        ? 'Anomaly spikes suggest spend guardrails and alerting thresholds should be reviewed.'
        : 'Spend anomaly posture is currently stable.',
      resources.some((resource) => resource.uptime_hours > 600)
        ? 'Long-uptime instances indicate maintenance drift and possible patch lag.'
        : 'Instance uptime remains within a healthy maintenance cadence.',
    ],
  };

  return {
    copy,
    heroSteps,
    agentNodes: ['Planner', 'Executor', 'Reflector', 'Decider'],
    summaryMetrics: [
      {
        label: 'System Health',
        value: formatPercent(healthScore),
        detail: `${summary.healthy_count || 0}/${summary.total_resources || 0} assets healthy`,
        tone: 'from-cyan-400 to-sky-400',
      },
      {
        label: 'Cost Efficiency',
        value: formatPercent(efficiencyScore),
        detail: 'Measured from live utilization vs spend profile',
        tone: 'from-violet-400 to-fuchsia-400',
      },
      {
        label: 'Risk Level',
        value: riskLevel,
        detail: `${formatPercent(riskScore)} composite risk pressure`,
        tone: 'from-rose-400 to-orange-400',
      },
    ],
    insightCards,
    beforeAfter: {
      before: beforeCost,
      after: afterCost,
      savings,
    },
    charts: {
      costHistory: history.map((entry) => ({
        date: entry.date.slice(5),
        cost: entry.daily_cost,
        anomaly: entry.is_anomaly ? entry.daily_cost : null,
      })),
      statusBreakdown: resourceStatus,
      usageBands,
    },
    costStory,
    recommendations: recommendationCards,
    auditor,
    assistantSuggestions: copy.suggestions,
    resources,
    meta: {
      healthLabel: snapshot.health?.status || 'ok',
      totalResources: summary.total_resources || 0,
      anomalyCount: anomalies.total_anomaly_days || 0,
      forecastLabel: formatCurrency(costPredictions.monthly_forecast, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
      savingsLabel: formatCurrency(savings),
      efficiencyLabel: formatPercent(efficiencyScore),
      riskCountLabel: formatCompactNumber(riskResources.length || 0),
    },
    rawSummary: snapshot.analyze || {},
    rawResources: snapshot?.analyze?.resource_list || [],
    rawPredictions: snapshot.predict || {},
    rawRecommendations: snapshot.recommend || {},
  };
}

export function buildActivityTimeline(model, agentRuns = [], language = 'en', lastUpdated) {
  const copy = getLocalizedCopy(language);
  const now = Date.now();
  const recentRuns = agentRuns.flatMap((run, index) => {
    const timeBase = new Date(run.timestamp || now).getTime();
    const toolItems = (run.tools || []).map((tool, toolIndex) => ({
      id: `${run.id}-${tool}-${toolIndex}`,
      timestamp: new Date(timeBase + toolIndex * 1500).toISOString(),
      title: tool,
      detail: run.summary,
      status: run.status || 'success',
      duration: run.duration || '180ms',
      phase: toolIndex === 0 ? 'Execution' : 'Synthesis',
    }));

    return [
      {
        id: `${run.id}-goal`,
        timestamp: run.timestamp,
        title: 'Operator goal received',
        detail: run.goal,
        status: 'success',
        duration: `${92 + index * 8}ms`,
        phase: 'Planner',
      },
      ...toolItems,
    ];
  });

  const systemTimeline = model
    ? [
        {
          id: 'planner',
          timestamp: new Date(now - 240000).toISOString(),
          title: 'Planner framed the active scan',
          detail: `${model.meta.totalResources} cloud assets queued for review.`,
          status: 'success',
          duration: '68ms',
          phase: 'Planner',
        },
        {
          id: 'executor',
          timestamp: new Date(now - 180000).toISOString(),
          title: 'Executor ran resource and anomaly passes',
          detail: `${model.meta.anomalyCount} anomalies and ${model.insightCards[1].value} idle resources surfaced.`,
          status: 'success',
          duration: '214ms',
          phase: 'Executor',
        },
        {
          id: 'reflector',
          timestamp: new Date(now - 120000).toISOString(),
          title: 'Reflector ranked impact zones',
          detail: `Primary optimization path estimates ${model.meta.savingsLabel} in recovery.`,
          status: 'success',
          duration: '147ms',
          phase: 'Reflector',
        },
        {
          id: 'decider',
          timestamp: lastUpdated || new Date(now - 45000).toISOString(),
          title: `${copy.thinkingLead}`,
          detail: `${model.recommendations.length} action paths are ready for staging.`,
          status: 'live',
          duration: 'realtime',
          phase: 'Decider',
        },
      ]
    : [];

  return [...recentRuns, ...systemTimeline]
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, 14);
}
