#!/usr/bin/env python3
"""Validate every rendered route against its generated debug centerline."""

import json
import math
import os

import pyproj
from shapely.geometry import LineString, Point
from shapely.ops import transform


DATA_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..',
    'map-app',
    'public',
    'data',
    'routes.geojson',
)
MIN_SEGMENT_LENGTH = 0.5
ROUNDING_DISTANCE_TOLERANCE = 0.01
ENDPOINT_TOLERANCE = 100

to_utm = pyproj.Transformer.from_crs(
    pyproj.CRS('EPSG:4326'),
    pyproj.CRS('EPSG:32634'),
    always_xy=True,
).transform


def projected_line(feature):
    return transform(to_utm, LineString(feature['geometry']['coordinates']))


def validate_pair(key, main_feature, debug_feature):
    main_coordinates = main_feature['geometry']['coordinates']
    debug_coordinates = debug_feature['geometry']['coordinates']
    assert len(main_coordinates) == len(debug_coordinates), (
        f'{key}: rendered/debug vertex counts differ '
        f'({len(main_coordinates)} != {len(debug_coordinates)})'
    )

    main = projected_line(main_feature)
    debug = projected_line(debug_feature)
    assert debug.length > 0, f'{key}: debug centerline is empty'

    length_ratio = main.length / debug.length
    assert 0.90 <= length_ratio <= 1.10, (
        f'{key}: rendered/debug length ratio {length_ratio:.6f} is unsafe'
    )

    endpoint_gap = (
        Point(debug.coords[0]).distance(Point(main.coords[0]))
        + Point(debug.coords[-1]).distance(Point(main.coords[-1]))
    )
    assert endpoint_gap <= ENDPOINT_TOLERANCE, (
        f'{key}: rendered endpoints moved {endpoint_gap:.3f}m'
    )

    for index, (source_start, source_end, candidate_start, candidate_end) in enumerate(zip(
        debug.coords,
        list(debug.coords)[1:],
        main.coords,
        list(main.coords)[1:],
    )):
        source_dx = source_end[0] - source_start[0]
        source_dy = source_end[1] - source_start[1]
        source_length = math.hypot(source_dx, source_dy)
        if source_length < MIN_SEGMENT_LENGTH:
            continue

        candidate_dx = candidate_end[0] - candidate_start[0]
        candidate_dy = candidate_end[1] - candidate_start[1]
        candidate_length = math.hypot(candidate_dx, candidate_dy)
        assert candidate_length >= MIN_SEGMENT_LENGTH - ROUNDING_DISTANCE_TOLERANCE, (
            f'{key}: segment {index} collapsed from {source_length:.3f}m '
            f'to {candidate_length:.3f}m'
        )

        direction_dot_product = source_dx * candidate_dx + source_dy * candidate_dy
        assert direction_dot_product > 0, (
            f'{key}: segment {index} reverses direction '
            f'({source_length:.3f}m source, {candidate_length:.3f}m rendered)'
        )

    assert not (debug.is_simple and not main.is_simple), (
        f'{key}: offset introduced a self-intersection into a simple centerline'
    )

    properties = main_feature['properties']
    requested_offset = properties['requested_offset_meters']
    applied_offset = properties['offset_meters']
    assert math.isfinite(requested_offset) and math.isfinite(applied_offset), (
        f'{key}: offset metadata must be finite'
    )
    assert abs(applied_offset) <= abs(requested_offset) + 1e-9, (
        f'{key}: applied offset {applied_offset} exceeds requested {requested_offset}'
    )
    assert applied_offset == 0 or applied_offset * requested_offset > 0, (
        f'{key}: applied offset changed side'
    )
    if applied_offset == 0:
        assert main_coordinates == debug_coordinates, (
            f'{key}: zero applied offset does not match the centerline'
        )

    return requested_offset, applied_offset


def main():
    with open(DATA_PATH, encoding='utf-8') as routes_file:
        routes = json.load(routes_file)

    pairs = {}
    for feature in routes['features']:
        properties = feature['properties']
        key = (properties['route_id'], properties['shape_id'])
        pair = pairs.setdefault(key, {})
        kind = 'debug' if properties['debug'] else 'main'
        assert kind not in pair, f'{key}: duplicate {kind} feature'
        pair[kind] = feature

    assert len(pairs) == 48, f'expected 48 route pairs, found {len(pairs)}'

    requested_offsets = []
    applied_offsets = []
    reduced_count = 0
    for key, pair in sorted(pairs.items()):
        assert set(pair) == {'main', 'debug'}, f'{key}: incomplete main/debug pair'
        requested, applied = validate_pair(key, pair['main'], pair['debug'])
        requested_offsets.append(abs(requested))
        applied_offsets.append(abs(applied))
        if abs(applied) + 1e-9 < abs(requested):
            reduced_count += 1

    print(
        'Validated 48 route pairs: no local reversals, no newly introduced '
        'self-intersections, equal vertex counts, safe lengths/endpoints, and '
        f'truthful offsets ({reduced_count} reduced; applied range '
        f'{min(applied_offsets):.3f}-{max(applied_offsets):.3f}m; requested max '
        f'{max(requested_offsets):.3f}m).'
    )


if __name__ == '__main__':
    main()
