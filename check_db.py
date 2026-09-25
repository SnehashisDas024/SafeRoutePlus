import psycopg2
conn = psycopg2.connect('postgresql://postgres:hkAd%2A23301Sfd%24@localhost:5432/saferoute')
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
tables = cur.fetchall()
for t in tables:
    print(t[0])
try:
    cur.execute('SELECT PostGIS_Version();')
    print('PostGIS:', cur.fetchone())
except:
    print('PostGIS: NOT INSTALLED')
try:
    cur.execute("SELECT * FROM pg_extension WHERE extname IN ('postgis', 'h3');")
    print('Extensions:', cur.fetchall())
except:
    print('Extensions query failed')
conn.close()