"""
CUF-equivalent schema (assumption A2).

The real Common Upload Form field list is not published, so this is derived from
the fields named in the problem statement plus the MoSPI Flash Report columns.
Swapping in the real CUF is a change to this file alone.
"""
from __future__ import annotations

# ---------------------------------------------------------------- raw panel

SNAPSHOT_COLUMNS = [
    "project_id",
    "project_name",
    "ministry",
    "sector",
    "state",
    "implementing_agency",
    "funding_mode",
    "sanction_date",
    "original_cost_cr",
    "original_commissioning_date",
    "snapshot_month",
    "anticipated_cost_cr",
    "anticipated_commissioning_date",
    "expenditure_cr",
    "physical_progress_pct",
    "project_status",
    "reason_for_delay",
    # Outcome columns. Present only on completed projects, and never features.
    "actual_cost_cr",
    "actual_commissioning_date",
]

REQUIRED_COLUMNS = [
    "project_id",
    "project_name",
    "ministry",
    "sector",
    "state",
    "implementing_agency",
    "sanction_date",
    "original_cost_cr",
    "original_commissioning_date",
    "snapshot_month",
    "expenditure_cr",
    "physical_progress_pct",
    "project_status",
]

# --------------------------------------------------------------- reference

SECTORS = [
    # sector, ministry, trouble multiplier, share of portfolio
    ("Railways", "Ministry of Railways", 1.55, 0.145),
    ("Road Transport & Highways", "Ministry of Road Transport & Highways", 1.30, 0.150),
    ("Power", "Ministry of Power", 0.95, 0.075),
    ("Petroleum", "Ministry of Petroleum & Natural Gas", 0.70, 0.085),
    ("Coal", "Ministry of Coal & Mines", 1.10, 0.055),
    ("Urban Development", "Ministry of Housing & Urban Affairs", 1.60, 0.070),
    ("Water Resources", "Ministry of Jal Shakti", 1.35, 0.045),
    ("Telecommunications", "Ministry of Communications", 0.65, 0.030),
    ("Civil Aviation", "Ministry of Civil Aviation", 0.90, 0.028),
    ("Shipping & Ports", "Ministry of Ports, Shipping & Waterways", 1.05, 0.032),
    ("Steel", "Ministry of Steel", 0.85, 0.030),
    ("Atomic Energy", "Department of Atomic Energy", 1.25, 0.022),
    ("Health & Family Welfare", "Ministry of Health & Family Welfare", 1.15, 0.034),
    ("Fertilizers", "Ministry of Chemicals & Fertilizers", 0.95, 0.020),
    ("Mines", "Ministry of Coal & Mines", 1.00, 0.016),
    ("Defence Production", "Ministry of Defence", 1.20, 0.026),
    ("Higher Education", "Ministry of Education", 1.10, 0.024),
    ("Science & Technology", "Ministry of Education", 0.90, 0.018),
    ("Textiles", "Ministry of Commerce & Industry", 0.80, 0.012),
    ("Food Processing", "Ministry of Commerce & Industry", 0.85, 0.014),
    ("New & Renewable Energy", "Ministry of Power", 0.75, 0.030),
    ("Shipbuilding", "Ministry of Ports, Shipping & Waterways", 1.10, 0.010),
]

AGENCIES = {
    "Railways": ["RVNL", "IRCON", "DFCCIL", "RITES"],
    "Road Transport & Highways": ["NHAI", "NHIDCL", "CPWD"],
    "Power": ["PGCIL", "NTPC", "NHPC", "THDC"],
    "Petroleum": ["IOCL", "ONGC", "GAIL", "BPCL"],
    "Coal": ["CIL", "NLCIL", "SECL"],
    "Urban Development": ["DMRC", "NBCC", "CPWD", "MMRDA"],
    "Water Resources": ["WAPCOS", "NPCC", "CWC"],
    "Telecommunications": ["BSNL", "BBNL", "C-DOT"],
    "Civil Aviation": ["AAI", "AAIL"],
    "Shipping & Ports": ["SDCL", "IPRCL", "CoPT"],
    "Steel": ["SAIL", "RINL", "MECON"],
    "Atomic Energy": ["NPCIL", "BHAVINI"],
    "Health & Family Welfare": ["HSCC", "CPWD", "NBCC"],
    "Fertilizers": ["RCF", "FCIL", "NFL"],
    "Mines": ["HCL", "NALCO", "GSI"],
    "Defence Production": ["BEL", "HAL", "BEML"],
    "Higher Education": ["CPWD", "NBCC", "EdCIL"],
    "Science & Technology": ["CSIR", "NBCC"],
    "Textiles": ["NTC", "CPWD"],
    "Food Processing": ["NIFTEM", "NBCC"],
    "New & Renewable Energy": ["SECI", "IREDA"],
    "Shipbuilding": ["CSL", "GRSE", "HSL"],
}

STATES = [
    "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
    "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "MULTI",
]

MONSOON_EXPOSED = {
    "Assam", "Bihar", "Kerala", "Maharashtra", "Odisha", "West Bengal",
    "Chhattisgarh", "Jharkhand",
}

DELAY_REASONS = [
    ("land", "Land acquisition pending in {n} villages"),
    ("land", "Land acquisition and rehabilitation under process"),
    ("forest", "Forest clearance awaited from MoEFCC"),
    ("forest", "Environment clearance under appraisal"),
    ("contractor", "Contractor mobilisation slow; EPC agency under notice"),
    ("contractor", "Termination and re-tendering of EPC package"),
    ("funds", "Fund release constrained in current fiscal"),
    ("litigation", "Matter sub-judice before the High Court"),
    ("rnr", "R&R settlement with project-affected families pending"),
    ("row", "ROW and utility shifting in progress"),
    ("approvals", "Statutory approvals awaited from State authorities"),
    ("forcemajeure", "Work affected by extended monsoon and flooding"),
]

DELAY_CATEGORIES = sorted({c for c, _ in DELAY_REASONS}) + ["none"]

# ------------------------------------------------------- A3 anchors (§0 A3)

CALIBRATION = {
    "ongoing_projects": 1981,
    "ministries": 17,
    "sectors": 22,
    "original_cost_cr": 3_713_000.0,   # ₹37.13 lakh crore
    "revised_cost_cr": 4_278_000.0,    # ₹42.78 lakh crore
    "expenditure_cr": 2_036_000.0,     # ₹20.36 lakh crore
}

# ------------------------------------------------------------ hero projects

HERO_IDS = ["PRJ-004217", "PRJ-001188", "PRJ-002904", "PRJ-003355"]
