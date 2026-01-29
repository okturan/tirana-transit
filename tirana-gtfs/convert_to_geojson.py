#!/usr/bin/env python3
"""Convert Tirana GTFS data to GeoJSON for the React map app."""

import csv
import json
import os
import sys
from collections import defaultdict
from shapely.geometry import LineString, Point
from shapely.ops import transform
import pyproj

# Output directory - by default writes to ../tirana-transit/public/data/
# Can be overridden with OUTPUT_DIR environment variable
DEFAULT_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tirana-transit', 'public', 'data')
OUTPUT_DIR = os.environ.get('OUTPUT_DIR', DEFAULT_OUTPUT_DIR)

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

def clean_text(text):
    """Clean up encoding issues in text fields."""
    if not text:
        return text
    import re
    # Replace ?...? pattern with "..." (complete pairs)
    text = re.sub(r'\?([^?]+)\?', r'"\1"', text)
    # Handle orphan ? before a word (opening quote without closing)
    text = re.sub(r'\?([A-ZËÇÜ])', r'"\1', text)
    # Handle ? at end of quoted text (closing quote): word?"  or word?.
    text = re.sub(r'(\w)\?([.\s,]|$)', r'\1"\2', text)
    # Handle ? between words (likely a dash): "word ? word" -> "word - word"
    text = re.sub(r'\s\?\s', ' - ', text)
    return text

def parse_csv(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
        # Clean text fields
        for row in rows:
            for key in row:
                if isinstance(row[key], str):
                    row[key] = clean_text(row[key])
        return rows

# Better color palette
CUSTOM_COLORS = {
    '1A': ('#E53935', '#FFFFFF'),
    '1B': ('#F44336', '#FFFFFF'),
    '2':  ('#E91E63', '#FFFFFF'),
    '3A': ('#00BCD4', '#000000'),
    '3B': ('#0097A7', '#FFFFFF'),
    '3C': ('#26C6DA', '#000000'),
    '4':  ('#880E4F', '#FFFFFF'),
    '5A': ('#4CAF50', '#FFFFFF'),
    '5B': ('#2E7D32', '#FFFFFF'),
    '6':  ('#EC407A', '#FFFFFF'),
    '8A': ('#5E35B1', '#FFFFFF'),
    '8B': ('#7E57C2', '#FFFFFF'),
    '8C': ('#9575CD', '#FFFFFF'),
    '9A': ('#CDDC39', '#000000'),
    '9B': ('#9E9D24', '#FFFFFF'),
    '10A': ('#FF9800', '#000000'),
    '10B': ('#F57C00', '#FFFFFF'),
    '10C': ('#E65100', '#FFFFFF'),
    '11': ('#2196F3', '#FFFFFF'),
    '12': ('#26A69A', '#FFFFFF'),
    '13A': ('#9C27B0', '#FFFFFF'),
    '13B': ('#7B1FA2', '#FFFFFF'),
    '15A': ('#FF5722', '#FFFFFF'),
    '15B': ('#FF7043', '#FFFFFF'),
    '16A': ('#43A047', '#FFFFFF'),
    '16B': ('#66BB6A', '#000000'),
}

# Set up coordinate transformations for Tirana area
wgs84 = pyproj.CRS('EPSG:4326')
utm34n = pyproj.CRS('EPSG:32634')
to_utm = pyproj.Transformer.from_crs(wgs84, utm34n, always_xy=True).transform
to_wgs84 = pyproj.Transformer.from_crs(utm34n, wgs84, always_xy=True).transform

# Offset settings
# Albania has RIGHT-HAND traffic (steering wheel on left, drive on right)
# So buses travel on the RIGHT side of the road in their direction of travel
# We use NEGATIVE offset (Shapely's 'right' side) to position lines correctly
# 
# REDUCED OFFSETS for better visual appearance:
# Previous values (6m base + 6m per route) created too much spread for big corridors
# New values keep routes closer to road center while maintaining visibility
BASE_OFFSET = 4  # meters - puts line on correct side of road (was 6m)
OFFSET_PER_ROUTE = 5  # meters - offset between adjacent routes (was 6m)
MAX_TOTAL_OFFSET = 20  # meters - cap total offset (was 30m)
PROXIMITY_THRESHOLD = 35  # meters - detection threshold for shared corridors
CROSS_FAMILY_THRESHOLD = 0.40  # 40% - high threshold for cross-family corridor detection

def sample_line_points(coords, interval_meters=50):
    """Sample points along a line at regular intervals."""
    line = LineString(coords)
    line_utm = transform(to_utm, line)

    points = []
    length = line_utm.length
    distance = 0
    while distance <= length:
        point = line_utm.interpolate(distance)
        points.append((point.x, point.y))
        distance += interval_meters

    return points

def calculate_corridor_sharing(shape1_coords, shape2_coords):
    """Calculate what fraction of shape1 is within proximity of shape2."""
    if len(shape1_coords) < 2 or len(shape2_coords) < 2:
        return 0

    try:
        points1 = sample_line_points(shape1_coords, interval_meters=80)
        line2 = LineString(shape2_coords)
        line2_utm = transform(to_utm, line2)

        close_count = 0
        for px, py in points1:
            point = Point(px, py)
            distance = line2_utm.distance(point)
            if distance < PROXIMITY_THRESHOLD:
                close_count += 1

        if len(points1) == 0:
            return 0

        return close_count / len(points1)

    except Exception as e:
        return 0

def get_route_base_number(route_name):
    """Extract base number from route name (e.g., '1A' -> '1', '10B' -> '10')."""
    return ''.join(c for c in route_name if c.isdigit()) or route_name


def detect_corridor_groups(shape_geometries, route_to_shapes, route_short_names):
    """Detect which routes share corridors and assign them to groups."""
    print("Detecting corridor sharing between routes...")

    # Build route_shapes using proper mapping from route_to_shapes
    route_shapes = {}
    for route_id, shape_ids in route_to_shapes.items():
        short_name = route_short_names.get(route_id)
        if not short_name:
            continue
        route_shapes[short_name] = []
        for shape_id in shape_ids:
            if shape_id in shape_geometries:
                route_shapes[short_name].append(shape_geometries[shape_id])

    route_names = [name for name in route_shapes.keys() if route_shapes[name]]
    print(f"Found {len(route_names)} routes with shapes")

    # STEP 1: Group routes by their base number (family groups)
    # Routes like 1A, 1B share the same base "1" and ALWAYS overlap
    family_groups = defaultdict(list)
    for name in route_names:
        base = get_route_base_number(name)
        family_groups[base].append(name)

    print("\nFamily groups (routes sharing base number):")
    for base, members in sorted(family_groups.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 999):
        if len(members) > 1:
            print(f"  Family {base}: {members}")
    
    # Identify ring route families (circular routes that start/end at same point)
    # These should stay in their own family group, not merge with others
    ring_families = set()
    for base, members in family_groups.items():
        if len(members) >= 2:
            # Check if all members of this family are rings (start == end)
            all_rings = True
            for name in members:
                for shape_coords in route_shapes.get(name, []):
                    if len(shape_coords) > 1:
                        start = shape_coords[0]
                        end = shape_coords[-1]
                        # If start and end are very close, it's a ring
                        dist_sq = (start[0] - end[0])**2 + (start[1] - end[1])**2
                        if dist_sq > 1e-10:  # More than ~1m apart
                            all_rings = False
                            break
                if not all_rings:
                    break
            if all_rings:
                ring_families.add(base)
                print(f"  -> Ring family detected: {base} ({members})")

    # Build corridor groups using union-find
    parent = {name: name for name in route_names}

    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    # STEP 2: First, union all routes in the same family
    for base, members in family_groups.items():
        if len(members) > 1:
            print(f"  Family union: {members}")
            for i in range(1, len(members)):
                union(members[0], members[i])

    # STEP 3: Then check for cross-family corridor sharing (geographic proximity)
    print("\nCross-family corridor sharing:")

    # Only compare routes from DIFFERENT families
    # Skip ring families - they stay in their own group for proper opposite-side offsetting
    bases = list(family_groups.keys())
    for i, base1 in enumerate(bases):
        for j, base2 in enumerate(bases):
            if i >= j:
                continue
            
            # Skip if either family is a ring family
            if base1 in ring_families or base2 in ring_families:
                continue

            # Check if any route from family1 shares corridor with any route from family2
            max_sharing = 0
            for name1 in family_groups[base1]:
                for name2 in family_groups[base2]:
                    if name1 not in route_shapes or name2 not in route_shapes:
                        continue
                    for coords1 in route_shapes[name1]:
                        for coords2 in route_shapes[name2]:
                            sharing = calculate_corridor_sharing(coords1, coords2)
                            max_sharing = max(max_sharing, sharing)
                            sharing_rev = calculate_corridor_sharing(coords2, coords1)
                            max_sharing = max(max_sharing, sharing_rev)

            if max_sharing >= CROSS_FAMILY_THRESHOLD:
                # Union all routes from both families
                union(family_groups[base1][0], family_groups[base2][0])
                print(f"  {base1} <-> {base2}: {max_sharing:.0%} corridor sharing")

    # Group routes by their root
    groups = defaultdict(list)
    for name in route_names:
        root = find(name)
        groups[root].append(name)

    # Sort each group by SUFFIX first, then base number
    # This spreads family members (15A, 15B) apart in the slot order
    # e.g., instead of [3A,3B,3C,15A,15B] we get [3A,15A,3B,15B,3C]
    for root in groups:
        groups[root].sort(key=lambda x: (
            ''.join(c for c in x if not c.isdigit()),  # suffix first (A, B, C, or empty)
            int(get_route_base_number(x)) if get_route_base_number(x).isdigit() else 999
        ))

    # Assign corridor groups and slots
    corridor_assignments = {}
    group_id = 0
    for root, members in groups.items():
        if len(members) > 1:
            for slot, name in enumerate(members):
                corridor_assignments[name] = (f"corridor_{group_id}", slot, len(members))
            group_id += 1
        else:
            corridor_assignments[members[0]] = (None, 0, 1)

    return corridor_assignments

def get_offset_for_shape(short_name, direction, corridor_assignments):
    """
    Calculate offset for a route shape with proportional scaling.

    Uses NEGATIVE offset (RIGHT side of travel direction) because:
    - Albania has right-hand traffic
    - Buses travel on the RIGHT side of the road
    - Shapely's negative offset = right side of line direction

    When corridor groups are large, offsets are scaled proportionally to fit
    within MAX_TOTAL_OFFSET while preserving relative spacing between routes.
    """
    corridor_info = corridor_assignments.get(short_name, (None, 0, 1))
    group_id, slot, group_size = corridor_info

    if group_id is not None and group_size > 1:
        # Calculate the raw corridor spread
        center = (group_size - 1) / 2

        # Maximum possible deviation from center
        max_slot_deviation = max(center, group_size - 1 - center)
        max_raw_corridor_offset = max_slot_deviation * OFFSET_PER_ROUTE

        # Available space for corridor spread (leaving room for BASE_OFFSET)
        available_space = MAX_TOTAL_OFFSET - BASE_OFFSET

        # Scale factor to fit within available space
        if max_raw_corridor_offset > available_space:
            scale = available_space / max_raw_corridor_offset
        else:
            scale = 1.0

        # Calculate scaled corridor offset
        raw_offset = (slot - center) * (-OFFSET_PER_ROUTE)
        corridor_offset = raw_offset * scale
    else:
        corridor_offset = 0

    # Base offset: RIGHT side of travel direction (negative in Shapely)
    total = -BASE_OFFSET + corridor_offset
    return total

def offset_line_geographic(coords, offset_meters):
    """Offset a line by a given number of meters using geographic projection."""
    if offset_meters == 0 or len(coords) < 2:
        return coords

    # Check if this is a ring (closed loop) - start and end points are very close
    start = coords[0]
    end = coords[-1]
    is_ring = ((start[0] - end[0])**2 + (start[1] - end[1])**2)**0.5 < 0.0001  # ~10m threshold

    # For rings, remove the duplicate end point to make it a line
    # parallel_offset works better on open lines
    # IMPORTANT: Make a copy to avoid modifying the original list
    working_coords = coords[:-1] if is_ring else list(coords)

    if len(working_coords) < 2:
        return coords

    try:
        line = LineString(working_coords)
        line_utm = transform(to_utm, line)

        distance = abs(offset_meters)
        side = 'left' if offset_meters > 0 else 'right'

        offset_line_utm = line_utm.parallel_offset(
            distance,
            side=side,
            resolution=16,
            join_style=2,
            mitre_limit=2.0
        )

        if offset_line_utm.is_empty:
            return coords

        if offset_line_utm.geom_type == 'MultiLineString':
            # For non-rings, take the longest segment
            longest = max(offset_line_utm.geoms, key=lambda g: g.length)
            offset_line_utm = longest

        offset_line = transform(to_wgs84, offset_line_utm)
        result_coords = list(offset_line.coords)

        # Check if reversal needed (parallel_offset can reverse direction)
        original_start = working_coords[0]
        result_start = result_coords[0]
        result_end = result_coords[-1]

        dist_to_start = ((original_start[0] - result_start[0])**2 + (original_start[1] - result_start[1])**2)**0.5
        dist_to_end = ((original_start[0] - result_end[0])**2 + (original_start[1] - result_end[1])**2)**0.5

        if dist_to_end < dist_to_start:
            result_coords = result_coords[::-1]

        return [[c[0], c[1]] for c in result_coords]

    except Exception as e:
        print(f"  Warning: offset failed ({e}), using original geometry")
        return coords

# Load data
print("Loading GTFS data...")
routes = parse_csv('routes.txt')
shapes = parse_csv('shapes.txt')
stops = parse_csv('stops.txt')
trips = parse_csv('trips.txt')
stop_times = parse_csv('stop_times.txt')
timetables = parse_csv('timetables.txt')
calendar = parse_csv('calendar.txt')

print("Building data structures...")

stop_lookup = {s['stop_id']: s['stop_name'] for s in stops}

trip_to_route = {}
trip_to_service = {}
trip_to_direction = {}
for trip in trips:
    trip_to_route[trip['trip_id']] = trip['route_id']
    trip_to_service[trip['trip_id']] = trip['service_id']
    trip_to_direction[trip['trip_id']] = trip.get('direction_id', '0')

route_to_stops = defaultdict(set)
for st in stop_times:
    trip_id = st['trip_id']
    stop_id = st['stop_id']
    route_id = trip_to_route.get(trip_id)
    if route_id:
        route_to_stops[route_id].add(stop_id)

stop_to_routes = defaultdict(set)
for route_id, stop_ids in route_to_stops.items():
    for stop_id in stop_ids:
        stop_to_routes[stop_id].add(route_id)

print(f"Mapped {len(route_to_stops)} routes to their stops")

route_to_shapes = defaultdict(set)
for trip in trips:
    route_id = trip['route_id']
    shape_id = trip.get('shape_id', '')
    if shape_id:
        route_to_shapes[route_id].add(shape_id)

shape_points = defaultdict(list)
for point in shapes:
    shape_id = point['shape_id']
    seq = int(point['shape_pt_sequence'])
    lat = float(point['shape_pt_lat'])
    lon = float(point['shape_pt_lon'])
    shape_points[shape_id].append((seq, lon, lat))

shape_geometries = {}
for shape_id, points in shape_points.items():
    points.sort(key=lambda x: x[0])
    shape_geometries[shape_id] = [[p[1], p[2]] for p in points]

route_short_names = {r['route_id']: r['route_short_name'] for r in routes}

# Detect corridor sharing (pass route_to_shapes for proper mapping)
corridor_assignments = detect_corridor_groups(shape_geometries, route_to_shapes, route_short_names)

print("\nCorridor group assignments:")
for name, (group, slot, size) in sorted(corridor_assignments.items(), key=lambda x: (x[1][0] or '', x[1][1])):
    if group:
        print(f"  {name}: {group}, slot {slot+1}/{size}")

# Build timetable data
print("\nBuilding timetable data...")

trip_first_departures = {}
trip_stop_sequence = defaultdict(list)

for st in stop_times:
    trip_id = st['trip_id']
    seq = int(st['stop_sequence'])
    time = st['departure_time']
    stop_id = st['stop_id']
    trip_stop_sequence[trip_id].append((seq, time, stop_id))

for trip_id, stops_list in trip_stop_sequence.items():
    stops_list.sort(key=lambda x: x[0])
    if stops_list:
        trip_first_departures[trip_id] = stops_list[0][1]

service_patterns = {}
for cal in calendar:
    sid = cal['service_id']
    days = []
    if cal['monday'] == '1': days.append('Mon')
    if cal['tuesday'] == '1': days.append('Tue')
    if cal['wednesday'] == '1': days.append('Wed')
    if cal['thursday'] == '1': days.append('Thu')
    if cal['friday'] == '1': days.append('Fri')
    if cal['saturday'] == '1': days.append('Sat')
    if cal['sunday'] == '1': days.append('Sun')

    if days == ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']:
        pattern = 'Weekdays'
    elif days == ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']:
        pattern = 'Daily'
    elif days == ['Sat']:
        pattern = 'Saturday'
    elif days == ['Sun']:
        pattern = 'Sunday'
    elif days == ['Sat', 'Sun']:
        pattern = 'Weekend'
    else:
        pattern = ', '.join(days)

    service_patterns[sid] = {
        'pattern': pattern,
        'start_date': cal['start_date'],
        'end_date': cal['end_date']
    }

route_timetables = defaultdict(lambda: defaultdict(list))

for trip_id, dep_time in trip_first_departures.items():
    route_id = trip_to_route.get(trip_id)
    service_id = trip_to_service.get(trip_id)
    direction = trip_to_direction.get(trip_id, '0')

    if route_id and service_id and service_id in service_patterns:
        pattern = service_patterns[service_id]['pattern']
        key = f"{direction}_{pattern}"
        route_timetables[route_id][key].append(dep_time)

route_schedules = {}
for route_id, schedules in route_timetables.items():
    route_schedules[route_id] = {}
    for key, times in schedules.items():
        unique_times = sorted(set(times))
        formatted = [t[:5] for t in unique_times]
        route_schedules[route_id][key] = formatted

route_directions = defaultdict(dict)
for tt in timetables:
    route_id = tt['route_id']
    direction = tt['direction_id']
    direction_name = tt.get('direction_name', '')
    if direction_name:
        route_directions[route_id][direction] = direction_name

# Build routes GeoJSON
print("\nBuilding GeoJSON with corrected offsets...")
routes_features = []

for route in routes:
    route_id = route['route_id']
    short_name = route['route_short_name']
    shape_ids = route_to_shapes.get(route_id, set())

    if short_name in CUSTOM_COLORS:
        color, text_color = CUSTOM_COLORS[short_name]
    else:
        color = f"#{route['route_color']}" if route['route_color'] else "#3388ff"
        text_color = f"#{route['route_text_color']}" if route['route_text_color'] else "#ffffff"

    corridor_info = corridor_assignments.get(short_name, (None, 0, 1))

    for shape_id in sorted(shape_ids):
        if shape_id in shape_geometries:
            original_coords = shape_geometries[shape_id]
            direction = shape_id.split('_')[-1] if '_' in shape_id else '0'

            # Calculate offset (negative = right side of road)
            total_offset = get_offset_for_shape(short_name, direction, corridor_assignments)
            
            # For ring routes (circular routes like 13A/13B, 16A/16B):
            # If route name ends with 'B' or contains 'Antiorar', it's the reverse direction
            # Flip the offset so A and B appear on opposite sides of the road
            long_name = route.get('route_long_name', '').lower()
            if short_name.endswith('B') or 'antiorar' in long_name:
                total_offset = -total_offset

            if total_offset != 0:
                coords = offset_line_geographic(original_coords, total_offset)
            else:
                coords = original_coords

            # Main feature (with offset applied)
            feature = {
                "type": "Feature",
                "properties": {
                    "route_id": route_id,
                    "route_short_name": short_name,
                    "route_long_name": route['route_long_name'],
                    "route_color": color,
                    "route_text_color": text_color,
                    "shape_id": shape_id,
                    "direction": direction,
                    "corridor_group": corridor_info[0],
                    "offset_meters": total_offset,
                    "debug": False
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords
                }
            }
            routes_features.append(feature)

            # Debug feature (original coordinates, no offset)
            # For ring routes, remove duplicate end point to make it a proper line
            start = original_coords[0]
            end = original_coords[-1]
            is_ring = ((start[0] - end[0])**2 + (start[1] - end[1])**2)**0.5 < 0.0001
            debug_coords = original_coords[:-1] if is_ring else original_coords
            
            debug_feature = {
                "type": "Feature",
                "properties": {
                    "route_id": route_id,
                    "route_short_name": short_name,
                    "route_long_name": route['route_long_name'],
                    "route_color": color,
                    "route_text_color": text_color,
                    "shape_id": shape_id,
                    "direction": direction,
                    "corridor_group": corridor_info[0],
                    "offset_meters": 0,
                    "debug": True
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": debug_coords
                }
            }
            routes_features.append(debug_feature)

routes_geojson = {
    "type": "FeatureCollection",
    "features": routes_features
}

# Build stops GeoJSON
stops_features = []
for stop in stops:
    if stop['stop_lat'] and stop['stop_lon']:
        stop_id = stop['stop_id']
        associated_routes = list(stop_to_routes.get(stop_id, []))

        feature = {
            "type": "Feature",
            "properties": {
                "stop_id": stop_id,
                "stop_name": stop['stop_name'],
                "stop_desc": stop.get('stop_desc', ''),
                "route_ids": associated_routes
            },
            "geometry": {
                "type": "Point",
                "coordinates": [float(stop['stop_lon']), float(stop['stop_lat'])]
            }
        }
        stops_features.append(feature)

stops_geojson = {
    "type": "FeatureCollection",
    "features": stops_features
}

# Build route metadata
route_metadata = []
for route in routes:
    route_id = route['route_id']
    short_name = route['route_short_name']
    stop_ids = route_to_stops.get(route_id, set())
    shape_count = len(route_to_shapes.get(route_id, set()))

    if short_name in CUSTOM_COLORS:
        color, text_color = CUSTOM_COLORS[short_name]
    else:
        color = f"#{route['route_color']}" if route['route_color'] else "#3388ff"
        text_color = f"#{route['route_text_color']}" if route['route_text_color'] else "#ffffff"

    schedules = route_schedules.get(route_id, {})
    directions = route_directions.get(route_id, {})
    corridor_info = corridor_assignments.get(short_name, (None, 0, 1))

    route_metadata.append({
        "route_id": route_id,
        "short_name": short_name,
        "long_name": route['route_long_name'],
        "color": color,
        "text_color": text_color,
        "stop_count": len(stop_ids),
        "has_both_directions": shape_count > 1,
        "schedules": schedules,
        "directions": directions,
        "corridor_group": corridor_info[0]
    })

def sort_key(r):
    name = r['short_name']
    num = ''.join(c for c in name if c.isdigit())
    suffix = ''.join(c for c in name if not c.isdigit())
    return (int(num) if num else 999, suffix)

route_metadata.sort(key=sort_key)

# Save files
routes_path = os.path.join(OUTPUT_DIR, 'routes.geojson')
stops_path = os.path.join(OUTPUT_DIR, 'stops.geojson')
metadata_path = os.path.join(OUTPUT_DIR, 'route_metadata.json')

with open(routes_path, 'w', encoding='utf-8') as f:
    json.dump(routes_geojson, f)

with open(stops_path, 'w', encoding='utf-8') as f:
    json.dump(stops_geojson, f)

with open(metadata_path, 'w', encoding='utf-8') as f:
    json.dump(route_metadata, f, indent=2)

print(f"\nCreated {routes_path} with {len(routes_features)} route shapes")
print(f"Created {stops_path} with {len(stops_features)} stops")
print(f"Created {metadata_path} with {len(route_metadata)} routes")
