"""
Route segmentation utilities - split OSRM route geometry into ~200m segments with H3 indices
"""
import h3
from shapely.geometry import LineString, Point
from shapely.ops import transform
import pyproj

SEGMENT_LENGTH_M = 200

def segment_route_geometry(geometry, segment_length_m=SEGMENT_LENGTH_M):
    """
    Split a LineString geometry into segments of approximately segment_length_m.
    Returns list of segment dicts with: start_point, end_point, distance, h3_index
    
    geometry: OSRM GeoJSON LineString geometry (list of [lon, lat] coordinates)
    """
    # Convert OSRM coordinates (lon, lat) to Shapely LineString
    coords = [(coord[0], coord[1]) for coord in geometry["coordinates"]]
    line = LineString(coords)
    
    # Project to metric CRS for accurate distance calculations
    # Use UTM zone for Kolkata (zone 45N)
    project = pyproj.Transformer.from_crs("epsg:4326", "epsg:32645", always_xy=True).transform
    line_proj = transform(project, line)
    
    total_length = line_proj.length
    num_segments = max(1, int(total_length / segment_length_m))
    
    segments = []
    for i in range(num_segments):
        start_dist = i * segment_length_m
        end_dist = min((i + 1) * segment_length_m, total_length)
        
        # Get points at these distances along the projected line
        start_point_proj = line_proj.interpolate(start_dist)
        end_point_proj = line_proj.interpolate(end_dist)
        
        # Convert back to WGS84
        unproject = pyproj.Transformer.from_crs("epsg:32645", "epsg:4326", always_xy=True).transform
        start_point = transform(unproject, start_point_proj)
        end_point = transform(unproject, end_point_proj)
        
        # Midpoint for H3 indexing
        mid_point_proj = line_proj.interpolate((start_dist + end_dist) / 2)
        mid_point = transform(unproject, mid_point_proj)
        
        segment_length = end_dist - start_dist
        h3_idx = h3.latlng_to_cell(mid_point.y, mid_point.x, 9)
        
        segments.append({
            "start": [start_point.x, start_point.y],  # [lon, lat]
            "end": [end_point.x, end_point.y],
            "mid": [mid_point.x, mid_point.y],
            "distance": segment_length,
            "h3_index": h3_idx
        })
    
    return segments

def get_route_h3_cells(geometry):
    """Get all H3 cells intersected by a route (for quick lookups)."""
    coords = [(coord[0], coord[1]) for coord in geometry["coordinates"]]
    line = LineString(coords)
    
    # Sample points along the line and get H3 cells
    cells = set()
    for i in range(len(coords) - 1):
        p1, p2 = coords[i], coords[i+1]
        cells.add(h3.latlng_to_cell(p1[1], p1[0], 9))
        cells.add(h3.latlng_to_cell(p2[1], p2[0], 9))
    
    return list(cells)