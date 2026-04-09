"""UK Distribution Network Operator (DNO) regions reference data."""

DNO_REGIONS = [
    {"code": "ENWL", "name": "Electricity North West"},
    {"code": "NPG_NE", "name": "Northern Powergrid North East"},
    {"code": "NPG_YK", "name": "Northern Powergrid Yorkshire"},
    {"code": "SPEN_MW", "name": "SP Energy Networks Manweb"},
    {"code": "SPEN_D", "name": "SP Energy Networks Distribution"},
    {"code": "SSEN_S", "name": "SSEN Southern"},
    {"code": "SSEN_N", "name": "SSEN North"},
    {"code": "UKPN_SE", "name": "UK Power Networks South Eastern"},
    {"code": "UKPN_E", "name": "UK Power Networks Eastern"},
    {"code": "UKPN_LPN", "name": "UK Power Networks London"},
    {"code": "WPD_SM", "name": "WPD South Wales & South West"},
    {"code": "WPD_EM", "name": "WPD East Midlands"},
    {"code": "WPD_WM", "name": "WPD West Midlands"},
    {"code": "WPD_S", "name": "WPD South West"},
]

REGION_CODES = {r["code"] for r in DNO_REGIONS}
