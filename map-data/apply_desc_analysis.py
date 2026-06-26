import pandas as pd

path = "map-data/resource_new.csv"
df = pd.read_csv(path, dtype=str, keep_default_na=False)

category_fixes = {
    "Michigan AI Laboratory": "AI Development; Research & Methods; Consulting & Support",
    "Michigan Institute for Computational Discovery & Engineering": "AI Development; Research & Methods; Computing & Technical Resources",
    "Michigan Center for Applied and Interdisciplinary Mathematics": "AI Research; Development & Methods; Consulting & Support",
    "AI Institutes at Michigan (AIIM)": "AI Research; Development & Methods; Applied & Domain Focused Research",
    "Michigan Institute for Data & AI in Society": "AI Research; Development & Methods; Consulting & Support",
    "AI Connections": "AI Development; Research & Methods; Consulting & Support",
    "Digital Studies Institute": "Applied & Domain Focused Research; Ethics, Society & Policy; Arts, Humanities & Creative Practice",
}

tag_fixes = {
    "Bold Challenges": "Initiative",
}

audience_fixes = {
    "Advanced Research Computing": "Faculty; Graduate",
    "Data Science for Dynamic Intervention Decision Making Center (d3)": "Faculty; Graduate",
    "Statistical Analysis of Biomedical and Educational Research Group (SABER)": "Faculty; Graduate",
    "Clinical & Health Research Dissemination & Implementation Science Catalyst (DISC)": "Faculty; Graduate; Community/Industry",
    "AI & Digital Health Innovation": "Faculty; Graduate; Community/Industry",
    "Michigan Alzheimer's Disease Center": "Faculty; Graduate; Community/Industry",
    "Michigan AI Laboratory": "Faculty; Graduate",
    "Michigan Institute for Computational Discovery & Engineering": "Faculty; Undergraduate; Graduate",
    "Center for Global Health Equity": "Faculty; Undergraduate; Graduate",
    "Michigan Center for Applied and Interdisciplinary Mathematics": "Faculty; Undergraduate; Graduate",
    "Bold Challenges": "Faculty",
    "Center for Ethics, Society, and Computing (ESC)": "Faculty; Graduate; Community/Industry",
    "Digital Studies Institute": "Faculty; Undergraduate; Graduate; Community/Industry",
    "Science, Technology, and Public Policy (STPP) Program": "Faculty; Graduate; Community/Industry",
    "AI Institutes at Michigan (AIIM)": "Faculty; Graduate; Community/Industry",
    "Michigan Institute for Data & AI in Society": "Faculty; Undergraduate; Graduate; Community/Industry",
    "AI Connections": "Faculty; Graduate; Community/Industry",
    # mechanical normalization only (content unchanged)
    # ARIA intentionally left blank -- description column has no real content ("No description")
}

thematic_area_fixes = {
    "Advanced Research Computing": "Computing Infrastructure; Data Science & Statistics",
    "Data Science for Dynamic Intervention Decision Making Center (d3)": "Health",
    "Statistical Analysis of Biomedical and Educational Research Group (SABER)": "Health; Data Science & Statistics",
    "Clinical & Health Research Dissemination & Implementation Science Catalyst (DISC)": "Health",
    "AI & Digital Health Innovation": "Health",
    "Michigan Alzheimer's Disease Center": "Health",
    "Michigan AI Laboratory": "AI & Machine Learning",
    "Michigan Institute for Computational Discovery & Engineering": "AI & Machine Learning; Computing Infrastructure",
    "Center for Global Health Equity": "Health; Ethics & Policy",
    "Michigan Center for Applied and Interdisciplinary Mathematics": "Data Science & Statistics",
    "Center for Ethics, Society, and Computing (ESC)": "Ethics & Policy",
    "Digital Studies Institute": "Ethics & Policy; Arts & Humanities",
    "Science, Technology, and Public Policy (STPP) Program": "Ethics & Policy",
    "AI Institutes at Michigan (AIIM)": "AI & Machine Learning",
    "Michigan Institute for Data & AI in Society": "AI & Machine Learning; Data Science & Statistics",
    "AI Connections": "AI & Machine Learning",
    "Human Centered Computing Lab": "Human-Computer Interaction",
    "Schmidt AI in Science Postdoctoral Fellowship": "AI & Machine Learning",
    "Center for Academic Innovation": "Education",
    "Deep Blue Repositories": "Computing Infrastructure",
    "ICPSR": "Data Science & Statistics",
    "Michigan Robotics": "Robotics & Autonomy",
    "Mcity": "Robotics & Autonomy",
    "School of Information (SI)": "Human-Computer Interaction",
    "Department of Statistics": "Data Science & Statistics",
    "Department of Biostatistics": "Health; Data Science & Statistics",
    "Department of Computational Medicine & Bioinformatics": "Health; AI & Machine Learning",
    "Department of Learning Health Sciences": "Health",
    "Trust, Innovation & Ethics Research for Responsible AI (TIERRA)": "Health; Ethics & Policy",
    "Center for Data-Driven Drug Development and Treatment Assessment (DATA)": "Health; AI & Machine Learning",
    "Center for Prediction, Reasoning & Intelligence for Multiphysics Exploration (C-PRIME)": "Physical Sciences & Engineering; AI & Machine Learning",
    "Center for Complex Particle Systems (COMPASS)": "Physical Sciences & Engineering",
    # ARIA and Bold Challenges intentionally left blank -- no clear domain theme to extract
}

# mechanical audience-format normalization for rows not already in audience_fixes
norm_map = {
    "Graduate Students/Postdocs": "Graduate",
    "Undergraduate Students": "Undergraduate",
    "Community, Industry, and External Partners": "Community/Industry",
}

names_seen = set(df["resource_name"])

def assert_known(d, label):
    unknown = set(d) - names_seen
    if unknown:
        raise SystemExit(f"{label}: unknown resource_name(s): {unknown}")

assert_known(category_fixes, "category_fixes")
assert_known(tag_fixes, "tag_fixes")
assert_known(audience_fixes, "audience_fixes")
assert_known(thematic_area_fixes, "thematic_area_fixes")

changes_log = []

for i, row in df.iterrows():
    name = row["resource_name"]

    if name in category_fixes and row["category"] != category_fixes[name]:
        changes_log.append((name, "category", row["category"], category_fixes[name]))
        df.at[i, "category"] = category_fixes[name]

    if name in tag_fixes and row["tag"] != tag_fixes[name]:
        changes_log.append((name, "tag", row["tag"], tag_fixes[name]))
        df.at[i, "tag"] = tag_fixes[name]

    # audience: explicit override takes priority; otherwise mechanical normalization
    old_aud = row["audience"]
    if name in audience_fixes:
        new_aud = audience_fixes[name]
    else:
        parts = [p.strip() for p in old_aud.split(";") if p.strip()]
        new_parts = [norm_map.get(p, p) for p in parts]
        new_aud = "; ".join(new_parts)
    if new_aud != old_aud:
        changes_log.append((name, "audience", old_aud, new_aud))
        df.at[i, "audience"] = new_aud

    if name in thematic_area_fixes and row["thematic_area"] != thematic_area_fixes[name]:
        changes_log.append((name, "thematic_area", row["thematic_area"], thematic_area_fixes[name]))
        df.at[i, "thematic_area"] = thematic_area_fixes[name]

df.to_csv(path, index=False)

print(f"Total cell changes: {len(changes_log)}")
for name, col, old, new in changes_log:
    print(f"- [{col}] {name}: {old!r} -> {new!r}")
