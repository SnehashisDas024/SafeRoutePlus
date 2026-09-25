def check_prolonged_stop(ping, stop_state, expected_wait_sec=120) -> bool:
    """
    Checks for prolonged stops based on speed and dwell time.
    ping: latest GpsPing
    stop_state: dict carrying state between pings
    """
    if ping.speed and ping.speed > 1.0: # 1 m/s threshold
        # Reset state if moving
        stop_state['stopped_since'] = None
        return False
        
    if not stop_state.get('stopped_since'):
        stop_state['stopped_since'] = ping.ts
        return False
        
    dwell_time = (ping.ts - stop_state['stopped_since']).total_seconds()
    
    # Simple rule-based baseline
    return dwell_time > expected_wait_sec

