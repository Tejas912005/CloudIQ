import sqlite3

def check_logs():
    conn = sqlite3.connect('cloudiq.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, role, message, intent, mode FROM chat_logs ORDER BY id DESC LIMIT 20")
    rows = cursor.fetchall()
    for row in rows:
        print(f"=== ID: {row[0]} | ROLE: {row[1]} | INTENT: {row[3]} | MODE: {row[4]} ===")
        print(repr(row[2]))
        print("="*40)
    conn.close()

if __name__ == '__main__':
    check_logs()
