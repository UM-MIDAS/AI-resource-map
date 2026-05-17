const map = L.map("map").setView([42.278642, -83.736033], 16);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 20,
}).addTo(map);

let geojsonLayer = null;
let resourceData = [];

const categories = [
  "AI Development",
  "AI Research",
  "Applied & Domain Focused Research",
  "Arts, Humanities & Creative Practice",
  "Computing & Technical Resources",
  "Consulting & Support",
  "Development & Methods",
  "Ethics, Society & Policy",
  "Funding & Project Development",
  "Research & Methods",
];

const audiences = ["Faculty", "Undergraduate", "Graduate"];

function parseCSV(text) {
  const rows = text.trim().split("\n");
  const headers = rows[0].split(",").map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
  });
}

function buildCheckboxes(list, containerId, prefix) {
  const container = document.getElementById(containerId);
  list.forEach((item) => {
    const div = document.createElement("div");
    div.className = "filter-item";
    div.innerHTML = `
      <input type="checkbox" id="${prefix}-${item}" value="${item}" checked onchange="applyFilter()"/>
      <label for="${prefix}-${item}">${item}</label>
    `;
    container.appendChild(div);
  });
}

function toggleAll(type, el) {
  const list = type === "category" ? categories : audiences;
  const prefix = type === "category" ? "cat" : "aud";
  list.forEach((item) => {
    document.getElementById(`${prefix}-${item}`).checked = el.checked;
  });
  applyFilter();
}

function toggleResourceList(event) {
  event.stopPropagation();
  document.getElementById("rightbar-button").style.display = "none";

  const selectedCats = categories.filter((c) => document.getElementById(`cat-${c}`).checked);
  const selectedAuds = audiences.filter((a) => document.getElementById(`aud-${a}`).checked);
  const allCatsSelected = selectedCats.length === categories.length;
  const allAudsSelected = selectedAuds.length === audiences.length;

  const filtered = resourceData.filter((p) => {
    const buildingCats = (p.category || "").split(";").map((s) => s.trim()).filter((s) => s);
    const buildingAuds = (p.audience || "").split(";").map((s) => s.trim()).filter((s) => s);
    const catMatch = allCatsSelected || (selectedCats.length > 0 && buildingCats.some((s) => selectedCats.includes(s)));
    const audMatch = allAudsSelected || (selectedAuds.length > 0 && buildingAuds.some((s) => selectedAuds.includes(s)));
    return catMatch && audMatch;
  });

  document.getElementById("rightbar-body").innerHTML = `
    ${filtered.map((p, i) => `
      <div class="toggle-card">
        <div class="toggle-card-header" onclick="openResourceCard(${i}, '${p.building_id}')">
          <span>${p.resource_name || "Unknown"}</span>
        </div>
        <div class="toggle-card-body" id="card-${i}" style="display:none;">
          <div class="info-row"><span class="info-label">Address</span>${p.address || ""}</div>
          <div class="info-row"><span class="info-label">Email</span><a href="mailto:${p.email}">${p.email || ""}</a></div>
          <div class="info-row"><span class="info-label">Website</span><a href="${p.url}" target="_blank">${p.url || ""}</a></div>
        </div>
      </div>
    `).join("")}
  `;
  document.getElementById("rightbar").classList.add("open");
}

function closeRightSidebar() {
  document.getElementById("rightbar").classList.remove("open");
  document.getElementById("rightbar-button").style.display = "block";
}

function toggleCard(i) {
  const body = document.getElementById(`card-${i}`);
  const header = body.previousElementSibling;
  const isOpen = body.style.display !== "none";

  // close all other cards first
  document.querySelectorAll(".toggle-card-body").forEach((b) => {
    b.style.display = "none";
    if (b.previousElementSibling) b.previousElementSibling.classList.remove("active");
  });

  body.style.display = isOpen ? "none" : "block";
  header.classList.toggle("active", !isOpen);
}

function updateResourceCount() {
  const selectedCats = categories.filter(
    (c) => document.getElementById(`cat-${c}`).checked,
  );
  const selectedAuds = audiences.filter(
    (a) => document.getElementById(`aud-${a}`).checked,
  );

  const allCatsSelected = selectedCats.length === categories.length;
  const allAudsSelected = selectedAuds.length === audiences.length;

  const count = resourceData.filter((p) => {
    const buildingCats = (p.category || "").split(";").map((s) => s.trim()).filter((s) => s);
    const buildingAuds = (p.audience || "").split(";").map((s) => s.trim()).filter((s) => s);

    const catMatch = allCatsSelected || (selectedCats.length > 0 && buildingCats.some((s) => selectedCats.includes(s)));
    const audMatch = allAudsSelected || (selectedAuds.length > 0 && buildingAuds.some((s) => selectedAuds.includes(s)));

    return catMatch && audMatch;
  }).length;

  document.getElementById("resource-count").textContent = count;
}

function openResourceCard(i, buildingId) {
  toggleCard(i);

  if (!buildingId || !geojsonLayer) return;
  geojsonLayer.eachLayer((layer) => {
    if (String(layer.feature.properties.building_id) === String(buildingId)) {
      const center = layer.getBounds().getCenter();
      map.flyTo(center, 18, { duration: 1 });
    }
  });
}

function applyFilter() {
  const selectedCats = categories.filter(
    (c) => document.getElementById(`cat-${c}`).checked,
  );
  const selectedAuds = audiences.filter(
    (a) => document.getElementById(`aud-${a}`).checked,
  );

  const allCatsSelected = selectedCats.length === categories.length;
  const allAudsSelected = selectedAuds.length === audiences.length;

  document.getElementById("cat-all").checked = allCatsSelected;
  document.getElementById("aud-all").checked = allAudsSelected;

  if (!geojsonLayer) return;

  geojsonLayer.eachLayer((layer) => {
    const props = layer.feature.properties;
    if (!props.is_resource) return;

    const buildingCats = Array.isArray(props.category)
      ? props.category
      : (props.category || "")
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s);

    const buildingAuds = Array.isArray(props.audience)
      ? props.audience
      : (props.audience || "")
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s);

    const catMatch =
      allCatsSelected ||
      (selectedCats.length > 0 &&
        buildingCats.some((s) => selectedCats.includes(s)));
    const audMatch =
      allAudsSelected ||
      (selectedAuds.length > 0 &&
        buildingAuds.some((s) => selectedAuds.includes(s)));

    const match = catMatch && audMatch;

    layer.setStyle({
      fillColor: match ? "#FFCB05" : "#02274d",
      fillOpacity: match ? 0.9 : 0.1,
    });
  });
  
  const sidebar = document.getElementById("rightbar");
  if (sidebar.classList.contains("open")) {
    const filtered = resourceData.filter((p) => {
      const buildingCats = (p.category || "")
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s);
      const buildingAuds = (p.audience || "")
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s);

      const catMatch =
        allCatsSelected ||
        (selectedCats.length > 0 &&
          buildingCats.some((s) => selectedCats.includes(s)));
      const audMatch =
        allAudsSelected ||
        (selectedAuds.length > 0 &&
          buildingAuds.some((s) => selectedAuds.includes(s)));

      return catMatch && audMatch;
    });

    document.getElementById("rightbar-body").innerHTML = `
    ${filtered
      .map(
        (p, i) => `
      <div class="toggle-card">
        <div class="toggle-card-header" onclick="openResourceCard(${i}, '${p.building_id}')">
  <span>${p.resource_name || "Unknown"}</span>
</div>
        <div class="toggle-card-body" id="card-${i}" style="display:none;">
          <div class="info-row"><span class="info-label">Address</span>${p.address || ""}</div>
          <div class="info-row"><span class="info-label">Email</span><a href="mailto:${p.email}">${p.email || ""}</a></div>
          <div class="info-row"><span class="info-label">Website</span><a href="${p.url}" target="_blank">${p.url || ""}</a></div>
        </div>
      </div>
    `,
      )
      .join("")}
  `;
  }
  updateResourceCount(); 
}

buildCheckboxes(categories, "category-list", "cat");
buildCheckboxes(audiences, "audience-list", "aud");

/* ── Load CSV ── */
fetch("map-data/resources-edited.csv")
  .then((res) => res.text())
  .then((csvText) => {
    resourceData = parseCSV(csvText).filter((r) => r.resource_name);
    updateResourceCount();
  });

/* ── Load GeoJSON ── */
fetch("map-data/um-building-footprint-edited.geojson")
  .then((res) => res.json())
  .then((data) => {
    geojsonLayer = L.geoJSON(data, {
      style: (feature) => ({
        color: "#02274d",
        weight: 0.75,
        fillColor: feature.properties.is_resource ? "#FFCB05" : "#02274d",
        fillOpacity: feature.properties.is_resource ? 0.9 : 0.1,
      }),
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(feature.properties.building_name || "Unknown", {
          sticky: true,
          className: "map-tooltip",
        });
        if (feature.properties.is_resource) {
          layer.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            layer.closeTooltip();
            map.flyTo(e.latlng, 18, { duration: 1 });

            const buildingId = feature.properties.building_id;
            const matches = resourceData.filter(
              (r) => r.building_id === String(buildingId),
            );

            if (matches.length === 0) {
              document.getElementById("rightbar-body").innerHTML = `
                <div class="info-card-title">No data found</div>
              `;
              document.getElementById("rightbar").classList.add("open");
              return;
            }

            if (matches.length === 1) {
              const p = matches[0];
              const resourceCategories = (p.category || "")
                .split(";")
                .map((s) => s.trim())
                .filter((s) => s);
              const resourceAudiences = (p.audience || "")
                .split(";")
                .map((s) => s.trim())
                .filter((s) => s);
              document.getElementById("rightbar-button").style.display = "none";

              document.getElementById("rightbar-body").innerHTML = `
                <div class="toggle-card">
                  <div class="toggle-card-header" onclick="toggleCard(0)">
                    <span>${p.resource_name || ""}</span>
                  </div>
                  <div class="toggle-card-body" id="card-0">
                  <div class="info-desc">${p.description || ""}</div>
                    <div class="info-row"><span class="info-label">Address</span>${p.address || ""}</div>
                    <div class="info-row"><span class="info-label">Email</span><a href="mailto:${p.email}">${p.email || ""}</a></div>
                    <div class="info-row"><span class="info-label">Website</span><a href="${p.url}" target="_blank">${p.url || ""}</a></div>
                    <div class="info-row">
                      <span class="info-label">Categories</span>
                      <div class="filter-tags">
                        ${resourceCategories.map((s) => `<span class="filter-tag">${s}</span>`).join("")}
                      </div>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Audience</span>
                      <div class="filter-tags">
                        ${resourceAudiences.map((s) => `<span class="filter-tag">${s}</span>`).join("")}
                      </div>
                    </div>
                  </div>
                </div>
              `;
            } else {
              document.getElementById("rightbar-button").style.display = "none";

              document.getElementById("rightbar-body").innerHTML = `
                ${matches
                  .map((p, i) => {
                    const resourceCategories = (p.category || "")
                      .split(";")
                      .map((s) => s.trim())
                      .filter((s) => s);
                    const resourceAudiences = (p.audience || "")
                      .split(";")
                      .map((s) => s.trim())
                      .filter((s) => s);
                    return `
                    <div class="toggle-card">
                      <div class="toggle-card-header" onclick="toggleCard(${i})">
                        <span>${p.resource_name || "Unknown"}</span>
                      </div>
                      <div class="toggle-card-body" id="card-${i}" style="display:none;">
                      <div class="info-desc">${p.description || ""}</div>
                        <div class="info-row"><span class="info-label">Address</span>${p.address || ""}</div>
                        <div class="info-row"><span class="info-label">Email</span><a href="mailto:${p.email}">${p.email || ""}</a></div>
                        <div class="info-row"><span class="info-label">Website</span><a href="${p.url}" target="_blank">${p.url || ""}</a></div>
                        <div class="info-row">
                          <span class="info-label">Categories</span>
                          <div class="filter-tags">
                            ${resourceCategories.map((s) => `<span class="filter-tag">${s}</span>`).join("")}
                          </div>
                        </div>
                        <div class="info-row">
                          <span class="info-label">Audience</span>
                          <div class="filter-tags">
                            ${resourceAudiences.map((s) => `<span class="filter-tag">${s}</span>`).join("")}
                          </div>
                        </div>
                        
                      </div>
                    </div>
                  `;
                  })
                  .join("")}
              `;
            }

            document.getElementById("rightbar").classList.add("open");
          });
        }
      },
    }).addTo(map);
  })
  .catch((err) => console.error("Failed to load GeoJSON:", err));

document.getElementById("rightbar").addEventListener("click", (e) => {
  e.stopPropagation();
});

document.getElementById("rightbar").addEventListener("wheel", (e) => {
  e.stopPropagation();
});

map.on("click", () => {
  closeRightSidebar();
});

/* ── Campus extents ── */
const extents = {
  central: { center: [42.278642, -83.736033], zoom: 16 },
  north: { center: [42.29504, -83.709576], zoom: 16 },
  dearborn: { center: [42.319058, -83.231381], zoom: 16 },
  flint: { center: [43.019819, -83.689921], zoom: 16 },
};

function goTo(key, btn) {
  const e = extents[key];
  map.flyTo(e.center, e.zoom, { duration: 1.5 });
  document
    .querySelectorAll("#extent-buttons button")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}