/* ════════════════════════════════════════════════
   Constants
═══════════════════════════════════════════════ */
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

const extents = {
  central:  { center: [42.278642, -83.736033], zoom: 16 },
  north:    { center: [42.29504,  -83.709576], zoom: 16 },
  dearborn: { center: [42.319058, -83.231381], zoom: 16 },
  flint:    { center: [43.019819, -83.689921], zoom: 16 },
};

/* ════════════════════════════════════════════════
   Map init
═══════════════════════════════════════════════ */
const map = L.map("map").setView(extents.central.center, extents.central.zoom);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 20,
}).addTo(map);

/* ════════════════════════════════════════════════
   State
═══════════════════════════════════════════════ */
let geojsonLayer = null;
let resourceData = [];

/* ════════════════════════════════════════════════
   Generic helpers
═══════════════════════════════════════════════ */
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

const parseList = (v) =>
  (v || "").split(";").map((s) => s.trim()).filter(Boolean);

/* ════════════════════════════════════════════════
   Filtering
═══════════════════════════════════════════════ */
function getSelectedFilters() {
  const selectedCats = categories.filter(
    (c) => document.getElementById(`cat-${c}`).checked,
  );
  const selectedAuds = audiences.filter(
    (a) => document.getElementById(`aud-${a}`).checked,
  );
  return {
    selectedCats,
    selectedAuds,
    allCatsSelected: selectedCats.length === categories.length,
    allAudsSelected: selectedAuds.length === audiences.length,
  };
}

function matchesFilter(cats, auds, filters) {
  const { selectedCats, selectedAuds, allCatsSelected, allAudsSelected } = filters;
  const catMatch =
    allCatsSelected ||
    (selectedCats.length > 0 && cats.some((s) => selectedCats.includes(s)));
  const audMatch =
    allAudsSelected ||
    (selectedAuds.length > 0 && auds.some((s) => selectedAuds.includes(s)));
  return catMatch && audMatch;
}

function getFilteredResources() {
  const filters = getSelectedFilters();
  return resourceData.filter((p) =>
    matchesFilter(parseList(p.category), parseList(p.audience), filters),
  );
}

/* ════════════════════════════════════════════════
   UI helpers
═══════════════════════════════════════════════ */
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

function closeRightSidebar() {
  document.getElementById("rightbar").classList.remove("open");
  document.getElementById("rightbar-button").style.display = "block";
}

/* ════════════════════════════════════════════════
   Resource card rendering
   ─ detailed: include description + category/audience tag rows
   ─ open:     start with card body visible (no display:none)
   ─ mode:     "flyTo"  → click flies map to the building
               "toggle" → click just expands/collapses the card
═══════════════════════════════════════════════ */
function renderResourceCard(p, i, { detailed = false, open = false, mode = "toggle" } = {}) {
  const onClickAttr =
    mode === "flyTo"
      ? `openResourceCard(${i}, '${p.building_id}')`
      : `toggleCard(${i})`;
  const bodyStyle = open ? "" : 'style="display:none;"';

  const description = detailed
    ? `<div class="info-desc">${p.description || ""}</div>`
    : "";

  const tagRows = detailed
    ? `
        <div class="info-row">
          <span class="info-label">Categories</span>
          <div class="filter-tags">
            ${parseList(p.category).map((s) => `<span class="filter-tag">${s}</span>`).join("")}
          </div>
        </div>
        <div class="info-row">
          <span class="info-label">Audience</span>
          <div class="filter-tags">
            ${parseList(p.audience).map((s) => `<span class="filter-tag">${s}</span>`).join("")}
          </div>
        </div>`
    : "";

  return `
    <div class="toggle-card">
      <div class="toggle-card-header" onclick="${onClickAttr}">
        <span>${p.resource_name || "Unknown"}</span>
      </div>
      <div class="toggle-card-body" id="card-${i}" ${bodyStyle}>
        ${description}
        <div class="info-row"><span class="info-label">Address</span>${p.address || ""}</div>
        <div class="info-row"><span class="info-label">Email</span><a href="mailto:${p.email}">${p.email || ""}</a></div>
        <div class="info-row"><span class="info-label">Website</span><a href="${p.url}" target="_blank">${p.url || ""}</a></div>
        ${tagRows}
      </div>
    </div>
  `;
}

function renderResourceList(resources, options) {
  return resources.map((p, i) => renderResourceCard(p, i, options)).join("");
}

/* ════════════════════════════════════════════════
   Main actions
═══════════════════════════════════════════════ */
function applyFilter() {
  const filters = getSelectedFilters();
  const { allCatsSelected, allAudsSelected } = filters;

  document.getElementById("cat-all").checked = allCatsSelected;
  document.getElementById("aud-all").checked = allAudsSelected;

  if (geojsonLayer) {
    geojsonLayer.eachLayer((layer) => {
      const props = layer.feature.properties;
      if (!props.is_resource) return;

      const cats = Array.isArray(props.category) ? props.category : parseList(props.category);
      const auds = Array.isArray(props.audience) ? props.audience : parseList(props.audience);
      const match = matchesFilter(cats, auds, filters);

      layer.setStyle({
        fillColor: match ? "#FFCB05" : "#02274d",
        fillOpacity: match ? 0.9 : 0.1,
      });
    });
  }

  // If the resource list is currently visible, refresh it
  const sidebar = document.getElementById("rightbar");
  if (sidebar.classList.contains("open")) {
    document.getElementById("rightbar-body").innerHTML = renderResourceList(
      getFilteredResources(),
      { mode: "flyTo" },
    );
  }

  updateResourceCount();
}

function updateResourceCount() {
  document.getElementById("resource-count").textContent =
    getFilteredResources().length;
}

function toggleResourceList(event) {
  event.stopPropagation();
  document.getElementById("rightbar-button").style.display = "none";
  document.getElementById("rightbar-body").innerHTML = renderResourceList(
    getFilteredResources(),
    { mode: "flyTo" },
  );
  document.getElementById("rightbar").classList.add("open");
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

function goTo(key, btn) {
  const e = extents[key];
  map.flyTo(e.center, e.zoom, { duration: 1.5 });
  document
    .querySelectorAll("#extent-buttons button")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

/* ════════════════════════════════════════════════
   Building-click handler (single building → sidebar)
═══════════════════════════════════════════════ */
function handleBuildingClick(feature, e) {
  L.DomEvent.stopPropagation(e);
  map.flyTo(e.latlng, 18, { duration: 1 });

  const matches = resourceData.filter(
    (r) => r.building_id === String(feature.properties.building_id),
  );
  const sidebar = document.getElementById("rightbar");
  const body = document.getElementById("rightbar-body");

  if (matches.length === 0) {
    body.innerHTML = `<div class="info-card-title">No data found</div>`;
  } else if (matches.length === 1) {
    document.getElementById("rightbar-button").style.display = "none";
    body.innerHTML = renderResourceCard(matches[0], 0, {
      detailed: true,
      open: true,
      mode: "toggle",
    });
  } else {
    document.getElementById("rightbar-button").style.display = "none";
    body.innerHTML = renderResourceList(matches, {
      detailed: true,
      mode: "toggle",
    });
  }

  sidebar.classList.add("open");
}

/* ════════════════════════════════════════════════
   Bootstrap: build UI, load data, wire events
═══════════════════════════════════════════════ */
buildCheckboxes(categories, "category-list", "cat");
buildCheckboxes(audiences, "audience-list", "aud");

fetch("map-data/resources-edited.csv")
  .then((res) => res.text())
  .then((csvText) => {
    resourceData = parseCSV(csvText).filter((r) => r.resource_name);
    updateResourceCount();
  });

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
            layer.closeTooltip();
            handleBuildingClick(feature, e);
          });
        }
      },
    }).addTo(map);
  })
  .catch((err) => console.error("Failed to load GeoJSON:", err));

document.getElementById("rightbar").addEventListener("click", (e) => e.stopPropagation());
document.getElementById("rightbar").addEventListener("wheel", (e) => e.stopPropagation());
map.on("click", () => closeRightSidebar());
