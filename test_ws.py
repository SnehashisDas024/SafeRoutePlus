import asyncio
import websockets
import json

async def test_ws():
    uri = 'ws://127.0.0.1:8000/trips/a2984130-f20e-411e-a86a-a2a747741b08/stream'
    try:
        async with websockets.connect(uri) as ws:
            print('Connected!')
            ping = {"lat": 22.57, "lon": 88.36, "speed": 1.2, "accuracy": 10.0}
            await ws.send(json.dumps(ping))
            resp = await ws.recv()
            print(f'Response: {resp}')
    except Exception as e:
        print(f'Error: {type(e).__name__}: {e}')

asyncio.run(test_ws())