/**
 * Cached home → site travel, one row per site.
 *
 * GENERATED, not hand-written: produced by asking OSRM for a distance matrix
 * over the stored coordinates. Real road distances, not straight lines.
 *
 * Frozen on purpose. Travel money is paid on these kilometres, so the number a
 * person is paid must not drift because OpenStreetMap changed a road: it is
 * computed once, stamped with the date and the routing profile, and refreshed
 * only when an address moves. Recomputing everything on a whim would silently
 * rewrite past compensation.
 *
 * Profile is OSRM's default `driving`, which optimises for the FASTEST route.
 * A true shortest-by-distance profile needs a separate OSRM build; if payroll
 * insists on shortest, that is a routing-server change, not a UI change, and
 * `profile` below is what tells you which numbers are which.
 */
export const TRAVEL_COMPUTED_AT = '2026-09-06'
export const TRAVEL_PROFILE = 'osrm/driving (fastest)'

/** siteId -> workerId -> one-way road distance and driving time. */
export const TRAVEL_CACHE: Record<string, Record<string, { km: number; minutes: number }>> = {
"v-dhl-inbound": {
"w-02": {
"km": 111.3,
"minutes": 95
},
"w-03": {
"km": 109.5,
"minutes": 90
},
"w-04": {
"km": 6.5,
"minutes": 11
},
"w-05": {
"km": 78.8,
"minutes": 71
},
"w-06": {
"km": 125.5,
"minutes": 105
},
"w-07": {
"km": 102.1,
"minutes": 84
},
"w-08": {
"km": 89.4,
"minutes": 73
},
"w-09": {
"km": 111.1,
"minutes": 94
},
"w-10": {
"km": 110.3,
"minutes": 92
},
"w-11": {
"km": 6.3,
"minutes": 11
},
"w-12": {
"km": 75.8,
"minutes": 70
},
"w-13": {
"km": 127.5,
"minutes": 108
},
"w-15": {
"km": 80.6,
"minutes": 71
},
"w-16": {
"km": 110.1,
"minutes": 92
},
"w-17": {
"km": 106.7,
"minutes": 91
},
"w-18": {
"km": 6.5,
"minutes": 11
},
"w-19": {
"km": 81.7,
"minutes": 73
},
"w-20": {
"km": 126.4,
"minutes": 107
},
"w-21": {
"km": 101.3,
"minutes": 84
},
"w-22": {
"km": 81.6,
"minutes": 72
},
"w-23": {
"km": 107.6,
"minutes": 90
},
"w-24": {
"km": 106.4,
"minutes": 90
},
"w-25": {
"km": 6,
"minutes": 11
},
"w-26": {
"km": 78.8,
"minutes": 67
},
"w-28": {
"km": 101,
"minutes": 83
},
"w-29": {
"km": 80.4,
"minutes": 69
},
"w-30": {
"km": 108.1,
"minutes": 91
},
"w-31": {
"km": 107.3,
"minutes": 90
},
"w-32": {
"km": 6.8,
"minutes": 12
},
"w-33": {
"km": 79.3,
"minutes": 70
},
"w-34": {
"km": 120.7,
"minutes": 103
},
"w-35": {
"km": 99.7,
"minutes": 81
},
"w-36": {
"km": 79.7,
"minutes": 68
},
"w-37": {
"km": 121.9,
"minutes": 103
},
"w-38": {
"km": 107.2,
"minutes": 90
},
"w-39": {
"km": 6.6,
"minutes": 11
},
"w-41": {
"km": 120.3,
"minutes": 103
},
"w-42": {
"km": 99.2,
"minutes": 81
},
"w-43": {
"km": 79.1,
"minutes": 67
},
"w-44": {
"km": 121.2,
"minutes": 103
},
"w-45": {
"km": 107.4,
"minutes": 90
}
},
"v-ah-evening": {
"w-02": {
"km": 77.4,
"minutes": 65
},
"w-03": {
"km": 26.8,
"minutes": 27
},
"w-04": {
"km": 78.7,
"minutes": 66
},
"w-05": {
"km": 60.4,
"minutes": 53
},
"w-06": {
"km": 81.2,
"minutes": 67
},
"w-07": {
"km": 19.3,
"minutes": 21
},
"w-08": {
"km": 6.8,
"minutes": 8
},
"w-09": {
"km": 77.2,
"minutes": 65
},
"w-10": {
"km": 27.6,
"minutes": 28
},
"w-11": {
"km": 68.2,
"minutes": 66
},
"w-12": {
"km": 60.9,
"minutes": 54
},
"w-13": {
"km": 83.2,
"minutes": 70
},
"w-15": {
"km": 5.5,
"minutes": 11
},
"w-16": {
"km": 76.2,
"minutes": 62
},
"w-17": {
"km": 23.9,
"minutes": 28
},
"w-18": {
"km": 67.6,
"minutes": 65
},
"w-19": {
"km": 67,
"minutes": 57
},
"w-20": {
"km": 82.1,
"minutes": 68
},
"w-21": {
"km": 18.5,
"minutes": 21
},
"w-22": {
"km": 5,
"minutes": 10
},
"w-23": {
"km": 72.6,
"minutes": 61
},
"w-24": {
"km": 23.7,
"minutes": 27
},
"w-25": {
"km": 80.5,
"minutes": 69
},
"w-26": {
"km": 64.1,
"minutes": 51
},
"w-28": {
"km": 18.3,
"minutes": 20
},
"w-29": {
"km": 3.9,
"minutes": 7
},
"w-30": {
"km": 72.6,
"minutes": 62
},
"w-31": {
"km": 24.3,
"minutes": 28
},
"w-32": {
"km": 66.1,
"minutes": 63
},
"w-33": {
"km": 64.6,
"minutes": 54
},
"w-34": {
"km": 76,
"minutes": 65
},
"w-35": {
"km": 17,
"minutes": 18
},
"w-36": {
"km": 3.1,
"minutes": 6
},
"w-37": {
"km": 81.7,
"minutes": 69
},
"w-38": {
"km": 24.2,
"minutes": 28
},
"w-39": {
"km": 84.5,
"minutes": 71
},
"w-41": {
"km": 75.6,
"minutes": 64
},
"w-42": {
"km": 16.5,
"minutes": 17
},
"w-43": {
"km": 2.3,
"minutes": 4
},
"w-44": {
"km": 82.5,
"minutes": 71
},
"w-45": {
"km": 24.4,
"minutes": 28
}
},
"v-postnl-sort": {
"w-02": {
"km": 87,
"minutes": 72
},
"w-03": {
"km": 36.4,
"minutes": 33
},
"w-04": {
"km": 83.1,
"minutes": 68
},
"w-05": {
"km": 76.3,
"minutes": 65
},
"w-06": {
"km": 90.7,
"minutes": 73
},
"w-07": {
"km": 30.5,
"minutes": 28
},
"w-08": {
"km": 23.6,
"minutes": 22
},
"w-09": {
"km": 86.8,
"minutes": 71
},
"w-10": {
"km": 33.5,
"minutes": 34
},
"w-11": {
"km": 72.5,
"minutes": 68
},
"w-12": {
"km": 76.3,
"minutes": 65
},
"w-13": {
"km": 92.7,
"minutes": 76
},
"w-15": {
"km": 24.8,
"minutes": 27
},
"w-16": {
"km": 85.8,
"minutes": 69
},
"w-17": {
"km": 32.5,
"minutes": 33
},
"w-18": {
"km": 71.9,
"minutes": 67
},
"w-19": {
"km": 82.2,
"minutes": 68
},
"w-20": {
"km": 91.7,
"minutes": 75
},
"w-21": {
"km": 29.7,
"minutes": 28
},
"w-22": {
"km": 24.4,
"minutes": 26
},
"w-23": {
"km": 82.1,
"minutes": 67
},
"w-24": {
"km": 30.8,
"minutes": 31
},
"w-25": {
"km": 84.8,
"minutes": 71
},
"w-26": {
"km": 79.3,
"minutes": 62
},
"w-28": {
"km": 30,
"minutes": 28
},
"w-29": {
"km": 23.2,
"minutes": 24
},
"w-30": {
"km": 82.2,
"minutes": 68
},
"w-31": {
"km": 30,
"minutes": 30
},
"w-32": {
"km": 70.4,
"minutes": 65
},
"w-33": {
"km": 79.8,
"minutes": 65
},
"w-34": {
"km": 85.6,
"minutes": 71
},
"w-35": {
"km": 30.6,
"minutes": 28
},
"w-36": {
"km": 13.7,
"minutes": 22
},
"w-37": {
"km": 91.2,
"minutes": 75
},
"w-38": {
"km": 29.9,
"minutes": 30
},
"w-39": {
"km": 88.8,
"minutes": 73
},
"w-41": {
"km": 85.2,
"minutes": 71
},
"w-42": {
"km": 30.1,
"minutes": 27
},
"w-43": {
"km": 12.8,
"minutes": 21
},
"w-44": {
"km": 92,
"minutes": 77
},
"w-45": {
"km": 30.1,
"minutes": 30
}
},
"v-ikea-logistics": {
"w-02": {
"km": 35.5,
"minutes": 33
},
"w-03": {
"km": 58.2,
"minutes": 49
},
"w-04": {
"km": 79.2,
"minutes": 66
},
"w-05": {
"km": 15.9,
"minutes": 19
},
"w-06": {
"km": 49.7,
"minutes": 43
},
"w-07": {
"km": 52.2,
"minutes": 43
},
"w-08": {
"km": 54.1,
"minutes": 44
},
"w-09": {
"km": 35.3,
"minutes": 32
},
"w-10": {
"km": 59,
"minutes": 50
},
"w-11": {
"km": 79.4,
"minutes": 67
},
"w-12": {
"km": 16.4,
"minutes": 19
},
"w-13": {
"km": 51.7,
"minutes": 47
},
"w-15": {
"km": 51.2,
"minutes": 46
},
"w-16": {
"km": 34.3,
"minutes": 30
},
"w-17": {
"km": 59.2,
"minutes": 53
},
"w-18": {
"km": 76.1,
"minutes": 67
},
"w-19": {
"km": 11.6,
"minutes": 19
},
"w-20": {
"km": 50.6,
"minutes": 45
},
"w-21": {
"km": 53.5,
"minutes": 46
},
"w-22": {
"km": 52.3,
"minutes": 47
},
"w-23": {
"km": 31.7,
"minutes": 28
},
"w-24": {
"km": 59,
"minutes": 52
},
"w-25": {
"km": 80.5,
"minutes": 69
},
"w-26": {
"km": 19.7,
"minutes": 17
},
"w-28": {
"km": 54.3,
"minutes": 47
},
"w-29": {
"km": 51.1,
"minutes": 44
},
"w-30": {
"km": 32.3,
"minutes": 29
},
"w-31": {
"km": 59.5,
"minutes": 53
},
"w-32": {
"km": 74.6,
"minutes": 66
},
"w-33": {
"km": 11.1,
"minutes": 19
},
"w-34": {
"km": 44.9,
"minutes": 41
},
"w-35": {
"km": 58.4,
"minutes": 48
},
"w-36": {
"km": 50.5,
"minutes": 43
},
"w-37": {
"km": 46.1,
"minutes": 41
},
"w-38": {
"km": 59.4,
"minutes": 53
},
"w-39": {
"km": 82.8,
"minutes": 71
},
"w-41": {
"km": 44.5,
"minutes": 41
},
"w-42": {
"km": 58,
"minutes": 47
},
"w-43": {
"km": 50.8,
"minutes": 43
},
"w-44": {
"km": 45.4,
"minutes": 41
},
"w-45": {
"km": 60,
"minutes": 53
}
},
"v-mojo-events": {
"w-02": {
"km": 4.3,
"minutes": 9
},
"w-03": {
"km": 65.5,
"minutes": 57
},
"w-04": {
"km": 113.8,
"minutes": 95
},
"w-05": {
"km": 51,
"minutes": 48
},
"w-06": {
"km": 14.7,
"minutes": 17
},
"w-07": {
"km": 61.5,
"minutes": 54
},
"w-08": {
"km": 82.5,
"minutes": 68
},
"w-09": {
"km": 4.2,
"minutes": 9
},
"w-10": {
"km": 66.3,
"minutes": 58
},
"w-11": {
"km": 114.1,
"minutes": 96
},
"w-12": {
"km": 51.5,
"minutes": 49
},
"w-13": {
"km": 16.7,
"minutes": 20
},
"w-15": {
"km": 83.7,
"minutes": 74
},
"w-16": {
"km": 4.1,
"minutes": 7
},
"w-17": {
"km": 66.5,
"minutes": 61
},
"w-18": {
"km": 110.8,
"minutes": 96
},
"w-19": {
"km": 45,
"minutes": 44
},
"w-20": {
"km": 15.7,
"minutes": 18
},
"w-21": {
"km": 63.8,
"minutes": 55
},
"w-22": {
"km": 83.3,
"minutes": 73
},
"w-23": {
"km": 5,
"minutes": 10
},
"w-24": {
"km": 66.3,
"minutes": 60
},
"w-25": {
"km": 115.2,
"minutes": 98
},
"w-26": {
"km": 47,
"minutes": 43
},
"w-28": {
"km": 64.2,
"minutes": 55
},
"w-29": {
"km": 82.1,
"minutes": 70
},
"w-30": {
"km": 5.5,
"minutes": 11
},
"w-31": {
"km": 66.8,
"minutes": 61
},
"w-32": {
"km": 109.3,
"minutes": 94
},
"w-33": {
"km": 45.2,
"minutes": 45
},
"w-34": {
"km": 9.5,
"minutes": 15
},
"w-35": {
"km": 65.8,
"minutes": 56
},
"w-36": {
"km": 82.2,
"minutes": 70
},
"w-37": {
"km": 5.7,
"minutes": 9
},
"w-38": {
"km": 66.7,
"minutes": 61
},
"w-39": {
"km": 117.4,
"minutes": 100
},
"w-41": {
"km": 9.1,
"minutes": 14
},
"w-42": {
"km": 65.4,
"minutes": 55
},
"w-43": {
"km": 83,
"minutes": 71
},
"w-44": {
"km": 5,
"minutes": 8
},
"w-45": {
"km": 67.3,
"minutes": 61
}
},
"v-klm-open": {
"w-02": {
"km": 21.1,
"minutes": 23
},
"w-03": {
"km": 46.4,
"minutes": 42
},
"w-04": {
"km": 118.1,
"minutes": 97
},
"w-05": {
"km": 55.2,
"minutes": 50
},
"w-06": {
"km": 24.3,
"minutes": 26
},
"w-07": {
"km": 42.3,
"minutes": 39
},
"w-08": {
"km": 63.3,
"minutes": 53
},
"w-09": {
"km": 20.9,
"minutes": 23
},
"w-10": {
"km": 47.2,
"minutes": 44
},
"w-11": {
"km": 118.3,
"minutes": 98
},
"w-12": {
"km": 55.7,
"minutes": 51
},
"w-13": {
"km": 26.3,
"minutes": 29
},
"w-15": {
"km": 64.5,
"minutes": 59
},
"w-16": {
"km": 20,
"minutes": 20
},
"w-17": {
"km": 47.3,
"minutes": 46
},
"w-18": {
"km": 115,
"minutes": 99
},
"w-19": {
"km": 49.3,
"minutes": 47
},
"w-20": {
"km": 25.3,
"minutes": 27
},
"w-21": {
"km": 44.7,
"minutes": 40
},
"w-22": {
"km": 64.1,
"minutes": 58
},
"w-23": {
"km": 16.3,
"minutes": 19
},
"w-24": {
"km": 47.1,
"minutes": 45
},
"w-25": {
"km": 119.5,
"minutes": 100
},
"w-26": {
"km": 51.3,
"minutes": 45
},
"w-28": {
"km": 45,
"minutes": 41
},
"w-29": {
"km": 62.9,
"minutes": 55
},
"w-30": {
"km": 16.4,
"minutes": 20
},
"w-31": {
"km": 47.6,
"minutes": 46
},
"w-32": {
"km": 113.6,
"minutes": 97
},
"w-33": {
"km": 49.4,
"minutes": 48
},
"w-34": {
"km": 19.7,
"minutes": 23
},
"w-35": {
"km": 46.7,
"minutes": 41
},
"w-36": {
"km": 63,
"minutes": 55
},
"w-37": {
"km": 24.8,
"minutes": 27
},
"w-38": {
"km": 47.5,
"minutes": 46
},
"w-39": {
"km": 121.7,
"minutes": 102
},
"w-41": {
"km": 19.3,
"minutes": 22
},
"w-42": {
"km": 46.2,
"minutes": 41
},
"w-43": {
"km": 63.8,
"minutes": 57
},
"w-44": {
"km": 25.6,
"minutes": 30
},
"w-45": {
"km": 48.1,
"minutes": 47
}
},
"v-dhl-open": {
"w-02": {
"km": 85.7,
"minutes": 70
},
"w-03": {
"km": 35.1,
"minutes": 31
},
"w-04": {
"km": 81.8,
"minutes": 66
},
"w-05": {
"km": 75,
"minutes": 63
},
"w-06": {
"km": 89.4,
"minutes": 71
},
"w-07": {
"km": 29.2,
"minutes": 26
},
"w-08": {
"km": 22.3,
"minutes": 20
},
"w-09": {
"km": 85.5,
"minutes": 69
},
"w-10": {
"km": 32.2,
"minutes": 32
},
"w-11": {
"km": 71.2,
"minutes": 66
},
"w-12": {
"km": 75,
"minutes": 63
},
"w-13": {
"km": 91.4,
"minutes": 74
},
"w-15": {
"km": 23.5,
"minutes": 25
},
"w-16": {
"km": 84.5,
"minutes": 67
},
"w-17": {
"km": 31.2,
"minutes": 31
},
"w-18": {
"km": 70.6,
"minutes": 65
},
"w-19": {
"km": 80.9,
"minutes": 66
},
"w-20": {
"km": 90.4,
"minutes": 73
},
"w-21": {
"km": 28.4,
"minutes": 26
},
"w-22": {
"km": 23.1,
"minutes": 24
},
"w-23": {
"km": 80.8,
"minutes": 65
},
"w-24": {
"km": 29.5,
"minutes": 29
},
"w-25": {
"km": 83.5,
"minutes": 69
},
"w-26": {
"km": 78,
"minutes": 60
},
"w-28": {
"km": 28.7,
"minutes": 26
},
"w-29": {
"km": 21.9,
"minutes": 22
},
"w-30": {
"km": 80.9,
"minutes": 66
},
"w-31": {
"km": 28.7,
"minutes": 28
},
"w-32": {
"km": 69.1,
"minutes": 63
},
"w-33": {
"km": 78.5,
"minutes": 63
},
"w-34": {
"km": 84.3,
"minutes": 69
},
"w-35": {
"km": 29.3,
"minutes": 26
},
"w-36": {
"km": 12.4,
"minutes": 20
},
"w-37": {
"km": 89.9,
"minutes": 73
},
"w-38": {
"km": 28.6,
"minutes": 28
},
"w-39": {
"km": 87.5,
"minutes": 71
},
"w-41": {
"km": 83.9,
"minutes": 69
},
"w-42": {
"km": 28.8,
"minutes": 25
},
"w-43": {
"km": 11.5,
"minutes": 19
},
"w-44": {
"km": 90.7,
"minutes": 75
},
"w-45": {
"km": 28.8,
"minutes": 28
}
},
"v-ah-roster": {
"w-02": {
"km": 22.6,
"minutes": 24
},
"w-03": {
"km": 67.2,
"minutes": 57
},
"w-04": {
"km": 125.1,
"minutes": 103
},
"w-05": {
"km": 63.7,
"minutes": 56
},
"w-06": {
"km": 1.2,
"minutes": 3
},
"w-07": {
"km": 63.2,
"minutes": 54
},
"w-08": {
"km": 84.2,
"minutes": 68
},
"w-09": {
"km": 22.4,
"minutes": 24
},
"w-10": {
"km": 68,
"minutes": 58
},
"w-11": {
"km": 125.3,
"minutes": 104
},
"w-12": {
"km": 64.1,
"minutes": 57
},
"w-13": {
"km": 3.4,
"minutes": 7
},
"w-15": {
"km": 85.4,
"minutes": 74
},
"w-16": {
"km": 21.5,
"minutes": 21
},
"w-17": {
"km": 68.2,
"minutes": 60
},
"w-18": {
"km": 122,
"minutes": 104
},
"w-19": {
"km": 56.9,
"minutes": 51
},
"w-20": {
"km": 3.8,
"minutes": 7
},
"w-21": {
"km": 65.5,
"minutes": 54
},
"w-22": {
"km": 84.9,
"minutes": 72
},
"w-23": {
"km": 23,
"minutes": 23
},
"w-24": {
"km": 67.9,
"minutes": 59
},
"w-25": {
"km": 126.4,
"minutes": 106
},
"w-26": {
"km": 59.7,
"minutes": 49
},
"w-28": {
"km": 65.8,
"minutes": 55
},
"w-29": {
"km": 83.8,
"minutes": 70
},
"w-30": {
"km": 21.1,
"minutes": 24
},
"w-31": {
"km": 68.5,
"minutes": 60
},
"w-32": {
"km": 120.5,
"minutes": 103
},
"w-33": {
"km": 60,
"minutes": 52
},
"w-34": {
"km": 4.9,
"minutes": 15
},
"w-35": {
"km": 67.5,
"minutes": 56
},
"w-36": {
"km": 83.9,
"minutes": 70
},
"w-37": {
"km": 9.3,
"minutes": 14
},
"w-38": {
"km": 68.4,
"minutes": 60
},
"w-39": {
"km": 128.7,
"minutes": 108
},
"w-41": {
"km": 5.3,
"minutes": 16
},
"w-42": {
"km": 67.1,
"minutes": 55
},
"w-43": {
"km": 84.7,
"minutes": 71
},
"w-44": {
"km": 10.1,
"minutes": 17
},
"w-45": {
"km": 68.9,
"minutes": 61
}
},
"v-ziggo": {
"w-02": {
"km": 7.3,
"minutes": 12
},
"w-03": {
"km": 62.5,
"minutes": 53
},
"w-04": {
"km": 105.2,
"minutes": 87
},
"w-05": {
"km": 42.4,
"minutes": 40
},
"w-06": {
"km": 21.9,
"minutes": 22
},
"w-07": {
"km": 58.5,
"minutes": 50
},
"w-08": {
"km": 79.5,
"minutes": 64
},
"w-09": {
"km": 7.1,
"minutes": 11
},
"w-10": {
"km": 63.3,
"minutes": 55
},
"w-11": {
"km": 105.5,
"minutes": 88
},
"w-12": {
"km": 42.9,
"minutes": 41
},
"w-13": {
"km": 23.9,
"minutes": 26
},
"w-15": {
"km": 71.1,
"minutes": 69
},
"w-16": {
"km": 6.2,
"minutes": 9
},
"w-17": {
"km": 63.5,
"minutes": 57
},
"w-18": {
"km": 102.2,
"minutes": 88
},
"w-19": {
"km": 36.4,
"minutes": 36
},
"w-20": {
"km": 22.9,
"minutes": 24
},
"w-21": {
"km": 60.8,
"minutes": 51
},
"w-22": {
"km": 80.2,
"minutes": 69
},
"w-23": {
"km": 6.9,
"minutes": 9
},
"w-24": {
"km": 63.2,
"minutes": 56
},
"w-25": {
"km": 106.6,
"minutes": 90
},
"w-26": {
"km": 38.4,
"minutes": 35
},
"w-28": {
"km": 61.1,
"minutes": 52
},
"w-29": {
"km": 79.1,
"minutes": 66
},
"w-30": {
"km": 7.4,
"minutes": 10
},
"w-31": {
"km": 63.8,
"minutes": 57
},
"w-32": {
"km": 100.7,
"minutes": 86
},
"w-33": {
"km": 36.6,
"minutes": 37
},
"w-34": {
"km": 20.1,
"minutes": 23
},
"w-35": {
"km": 62.8,
"minutes": 52
},
"w-36": {
"km": 70.4,
"minutes": 66
},
"w-37": {
"km": 18.3,
"minutes": 21
},
"w-38": {
"km": 63.7,
"minutes": 57
},
"w-39": {
"km": 108.8,
"minutes": 91
},
"w-41": {
"km": 19.7,
"minutes": 22
},
"w-42": {
"km": 62.4,
"minutes": 52
},
"w-43": {
"km": 70.7,
"minutes": 66
},
"w-44": {
"km": 17.6,
"minutes": 20
},
"w-45": {
"km": 64.2,
"minutes": 58
}
},
"v-warehouse": {
"w-02": {
"km": 65.9,
"minutes": 56
},
"w-03": {
"km": 15.3,
"minutes": 17
},
"w-04": {
"km": 94.9,
"minutes": 76
},
"w-05": {
"km": 69.3,
"minutes": 59
},
"w-06": {
"km": 69.7,
"minutes": 57
},
"w-07": {
"km": 7.9,
"minutes": 12
},
"w-08": {
"km": 15.7,
"minutes": 15
},
"w-09": {
"km": 65.7,
"minutes": 55
},
"w-10": {
"km": 16.1,
"minutes": 19
},
"w-11": {
"km": 84.3,
"minutes": 76
},
"w-12": {
"km": 69.8,
"minutes": 60
},
"w-13": {
"km": 71.7,
"minutes": 60
},
"w-15": {
"km": 16.9,
"minutes": 21
},
"w-16": {
"km": 64.7,
"minutes": 53
},
"w-17": {
"km": 12.5,
"minutes": 18
},
"w-18": {
"km": 83.7,
"minutes": 75
},
"w-19": {
"km": 75.9,
"minutes": 63
},
"w-20": {
"km": 70.6,
"minutes": 59
},
"w-21": {
"km": 7.1,
"minutes": 11
},
"w-22": {
"km": 16.5,
"minutes": 20
},
"w-23": {
"km": 61.1,
"minutes": 51
},
"w-24": {
"km": 12.2,
"minutes": 17
},
"w-25": {
"km": 96.6,
"minutes": 79
},
"w-26": {
"km": 73,
"minutes": 57
},
"w-28": {
"km": 6.8,
"minutes": 11
},
"w-29": {
"km": 15.3,
"minutes": 18
},
"w-30": {
"km": 61.1,
"minutes": 52
},
"w-31": {
"km": 12.8,
"minutes": 18
},
"w-32": {
"km": 82.2,
"minutes": 73
},
"w-33": {
"km": 73.6,
"minutes": 60
},
"w-34": {
"km": 64.5,
"minutes": 55
},
"w-35": {
"km": 5.5,
"minutes": 8
},
"w-36": {
"km": 15.4,
"minutes": 17
},
"w-37": {
"km": 70.2,
"minutes": 59
},
"w-38": {
"km": 12.7,
"minutes": 18
},
"w-39": {
"km": 100.6,
"minutes": 81
},
"w-41": {
"km": 64.1,
"minutes": 55
},
"w-42": {
"km": 5,
"minutes": 8
},
"w-43": {
"km": 16.2,
"minutes": 19
},
"w-44": {
"km": 71,
"minutes": 61
},
"w-45": {
"km": 12.9,
"minutes": 18
}
},
"v-evening-clean": {
"w-02": {
"km": 76.5,
"minutes": 64
},
"w-03": {
"km": 25.9,
"minutes": 26
},
"w-04": {
"km": 80.3,
"minutes": 68
},
"w-05": {
"km": 60.5,
"minutes": 53
},
"w-06": {
"km": 80.3,
"minutes": 66
},
"w-07": {
"km": 18.5,
"minutes": 20
},
"w-08": {
"km": 6.9,
"minutes": 9
},
"w-09": {
"km": 76.3,
"minutes": 64
},
"w-10": {
"km": 26.7,
"minutes": 27
},
"w-11": {
"km": 69.7,
"minutes": 69
},
"w-12": {
"km": 61,
"minutes": 54
},
"w-13": {
"km": 82.3,
"minutes": 69
},
"w-15": {
"km": 6.2,
"minutes": 12
},
"w-16": {
"km": 75.3,
"minutes": 61
},
"w-17": {
"km": 23.1,
"minutes": 27
},
"w-18": {
"km": 69.1,
"minutes": 67
},
"w-19": {
"km": 67.1,
"minutes": 58
},
"w-20": {
"km": 81.2,
"minutes": 67
},
"w-21": {
"km": 17.7,
"minutes": 19
},
"w-22": {
"km": 5.8,
"minutes": 11
},
"w-23": {
"km": 71.7,
"minutes": 59
},
"w-24": {
"km": 22.8,
"minutes": 26
},
"w-25": {
"km": 82,
"minutes": 71
},
"w-26": {
"km": 64.2,
"minutes": 52
},
"w-28": {
"km": 17.4,
"minutes": 19
},
"w-29": {
"km": 4.6,
"minutes": 9
},
"w-30": {
"km": 71.7,
"minutes": 61
},
"w-31": {
"km": 23.4,
"minutes": 27
},
"w-32": {
"km": 67.6,
"minutes": 66
},
"w-33": {
"km": 64.8,
"minutes": 54
},
"w-34": {
"km": 75.1,
"minutes": 64
},
"w-35": {
"km": 16.1,
"minutes": 17
},
"w-36": {
"km": 3.8,
"minutes": 8
},
"w-37": {
"km": 80.8,
"minutes": 67
},
"w-38": {
"km": 23.3,
"minutes": 27
},
"w-39": {
"km": 86,
"minutes": 74
},
"w-41": {
"km": 74.7,
"minutes": 63
},
"w-42": {
"km": 15.6,
"minutes": 16
},
"w-43": {
"km": 3.3,
"minutes": 7
},
"w-44": {
"km": 81.6,
"minutes": 70
},
"w-45": {
"km": 23.5,
"minutes": 27
}
}
}
