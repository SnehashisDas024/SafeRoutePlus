"""
OSM -> per-H3-cell static features
lit_ratio, police_dist_m, shop_density, road_class, transit_dist_m

For hackathon: synthetic generator for Kolkata bounding box
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

import h3
import random
import math
from app.models.database import SessionLocal
from app.models.schema import StaticFeature

# Kolkata bounding box (approximate)
KOLKATA_BBOX = {
    "min_lat": 22.45,
    "max_lat": 22.70,
    "min_lon": 88.20,
    "max_lon": 88.50,
}

H3_RESOLUTION = 9

def get_h3_cells_in_bbox(bbox, resolution):
    """Get all H3 cells covering the bounding box."""
    # h3.LatLngPoly expects list of (lat, lon) tuples
    polygon = [
        (bbox["min_lat"], bbox["min_lon"]),
        (bbox["min_lat"], bbox["max_lon"]),
        (bbox["max_lat"], bbox["max_lon"]),
        (bbox["max_lat"], bbox["min_lon"]),
        (bbox["min_lat"], bbox["min_lon"]),
    ]
    poly = h3.LatLngPoly(polygon)
    cells = h3.h3shape_to_cells(poly, resolution)
    return list(cells)

def classify_road_class():
    """Random road class based on Kolkata distribution."""
    return random.choices(
        ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "service"],
        weights=[2, 3, 8, 12, 15, 45, 15],
        k=1
    )[0]

def estimate_police_dist(lat, lon):
    """Estimate distance to nearest police station (meters)."""
    # Major police stations in Kolkata (approximate locations)
    police_stations = [
        (22.56, 88.36),   # Lalbazar HQ
        (22.58, 88.37),   # Park Street
        (22.54, 88.35),   # Alipore
        (22.60, 88.38),   # Salt Lake
        (22.52, 88.33),   # Behala
        (22.57, 88.42),   # Ruby
        (22.63, 88.40),   # New Town
        (22.50, 88.30),   # Maheshtala
    ]
    min_dist = float('inf')
    for ps_lat, ps_lon in police_stations:
        # Haversine distance
        dlat = math.radians(lat - ps_lat)
        dlon = math.radians(lon - ps_lon)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(ps_lat)) * math.sin(dlon/2)**2
        dist = 6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        min_dist = min(min_dist, dist)
    return min_dist

def estimate_transit_dist(lat, lon):
    """Estimate distance to nearest metro/rail station (meters)."""
    # Kolkata Metro stations (approximate)
    metro_stations = [
        (22.56, 88.36),   # Esplanade
        (22.55, 88.35),   # Park Street
        (22.54, 88.35),   # Maidan
        (22.58, 88.37),   # Rabindra Sadan
        (22.60, 88.38),   # Salt Lake Sector V
        (22.59, 88.37),   # Central
        (22.53, 88.34),   # Kalighat
        (22.52, 88.33),   # Tollygunge
    ]
    min_dist = float('inf')
    for ms_lat, ms_lon in metro_stations:
        dlat = math.radians(lat - ms_lat)
        dlon = math.radians(lon - ms_lon)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(ms_lat)) * math.sin(dlon/2)**2
        dist = 6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        min_dist = min(min_dist, dist)
    return min_dist

def estimate_shop_density(lat, lon, road_class):
    """Estimate shop density based on location and road class."""
    # Central Kolkata has higher density
    center_lat, center_lon = 22.57, 88.36
    dlat = lat - center_lat
    dlon = lon - center_lon
    dist_from_center = math.sqrt(dlat**2 + dlon**2) * 111000  # meters
    
    base_density = max(0, 100 - dist_from_center / 1000)  # decreases with distance
    
    # Road class multiplier
    multipliers = {
        "motorway": 0.1,
        "trunk": 0.3,
        "primary": 1.2,
        "secondary": 1.0,
        "tertiary": 0.8,
        "residential": 0.5,
        "service": 0.2,
    }
    return base_density * multipliers.get(road_class, 0.5) * random.uniform(0.5, 1.5)

def estimate_lit_ratio(road_class, shop_density):
    """Estimate lighting ratio based on road class and commercial activity."""
    base_lit = {
        "motorway": 0.9,
        "trunk": 0.85,
        "primary": 0.8,
        "secondary": 0.7,
        "tertiary": 0.6,
        "residential": 0.4,
        "service": 0.2,
    }
    # Commercial areas have better lighting
    commercial_boost = min(0.3, shop_density / 100)
    return min(1.0, base_lit.get(road_class, 0.5) + commercial_boost + random.uniform(-0.1, 0.1))

def build_static_features():
    print("Building static features from synthetic OSM data for Kolkata...")
    
    cells = get_h3_cells_in_bbox(KOLKATA_BBOX, H3_RESOLUTION)
    print(f"Found {len(cells)} H3 cells at resolution {H3_RESOLUTION}")
    
    db = SessionLocal()
    try:
        # Clear existing
        db.query(StaticFeature).delete()
        
        batch = []
        for i, cell in enumerate(cells):
            # Get cell center
            lat, lon = h3.cell_to_latlng(cell)
            
            # Only process cells within our bounding box
            if not (KOLKATA_BBOX["min_lat"] <= lat <= KOLKATA_BBOX["max_lat"] and
                    KOLKATA_BBOX["min_lon"] <= lon <= KOLKATA_BBOX["max_lon"]):
                continue
            
            road_class = classify_road_class()
            police_dist = estimate_police_dist(lat, lon)
            transit_dist = estimate_transit_dist(lat, lon)
            shop_density = estimate_shop_density(lat, lon, road_class)
            lit_ratio = estimate_lit_ratio(road_class, shop_density)
            
            feature = StaticFeature(
                h3_index=cell,
                lit_ratio=round(lit_ratio, 3),
                police_dist_m=round(police_dist, 1),
                shop_density=round(shop_density, 2),
                road_class=road_class,
                transit_dist_m=round(transit_dist, 1),
            )
            batch.append(feature)
            
            if len(batch) >= 100:
                db.bulk_save_objects(batch)
                db.commit()
                batch = []
                print(f"  Processed {i+1}/{len(cells)} cells...")
        
        if batch:
            db.bulk_save_objects(batch)
            db.commit()
        
        print(f"Static features built for {len(cells)} cells!")
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    build_static_features()