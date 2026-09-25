from fastapi import FastAPI
from app.api import routes_plan, trips, sos, voice, ws_stream

app = FastAPI()
app.include_router(routes_plan.router)
app.include_router(trips.router)
app.include_router(sos.router)
app.include_router(voice.router)
app.include_router(ws_stream.router)

# Trigger route building
app.router.startup()
print('Routes after startup:')
for r in app.router.routes:
    if hasattr(r, 'path'):
        methods = getattr(r, 'methods', 'WS')
        print(f'{methods} {r.path}')
    elif hasattr(r, 'path_regex'):
        print(f'WS {r.path_regex.pattern}')