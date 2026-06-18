/* ════════════
   Constants
════════════ */

// Service categories used to tag each AI resource.
// Order here = display order in the "Filter by Category" checkbox list.
// Must match the values used in resources-edited.csv exactly,
// otherwise filtering will silently miss rows.
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

// Audience groups used to tag each AI resource.
const audiences = ["Faculty", "Undergraduate", "Graduate"];

// Predefined map views for the campus extent buttons.
const extents = {
  central:  { center: [42.278642, -83.736033], zoom: 16 },
  north:    { center: [42.29504,  -83.709576], zoom: 16 },
  dearborn: { center: [42.319058, -83.231381], zoom: 16 },
  flint:    { center: [43.019819, -83.689921], zoom: 16 },
};

/* ════════════
   Map init
════════════ */

// Create the Leaflet map and add the Carto Light basemap tiles.
const map = L.map("map").setView(extents.central.center, extents.central.zoom);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 20,
}).addTo(map);

/* ════════════
   State
════════════ */

// The Leaflet GeoJSON layer holding all building polygons (set once data loads).
let geojsonLayer = null;

// Array of resource objects parsed from resources-edited.csv (set once data loads).
let resourceData = [];

/* ════════════
   Helpers
════════════ */

// Parses a CSV string into an array of objects keyed by header name.
// Handles quoted fields that contain commas (e.g. addresses, lists).
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

// Splits a semicolon-separated CSV cell into an array of trimmed, non-empty values.
// "AI Research; Consulting & Support" → ["AI Research", "Consulting & Support"]
const parseList = (v) =>
  (v || "").split(";").map((s) => s.trim()).filter(Boolean);

/* ════════════
   Filtering
════════════ */

// Reads the current state of all category/audience checkboxes and returns
// the selected items plus convenience flags for "are they all selected?".
// Used by every function that needs to know what the user is filtering by.
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

// Returns true if a resource's category + audience tags satisfy the active filters.
// When all checkboxes in a group are selected, that group is treated as a pass-through.
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

// Returns the subset of resourceData that matches the current filter state.
// Single source of truth for the sidebar list and the resource count badge.
function getFilteredResources() {
  const filters = getSelectedFilters();
  return resourceData.filter((p) =>
    matchesFilter(parseList(p.category), parseList(p.audience), filters),
  );
}

/* ════════════════════════════════════════════════
   UI helpers
═══════════════════════════════════════════════ */

// Generates one checkbox + label per item and appends them to the given container.
// `prefix` is used to namespace the checkbox IDs (e.g. "cat" → "cat-AI Research").
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

// Handler for the "Select All" checkbox in each filter group.
// Mirrors the master checkbox state onto every child checkbox, then re-applies the filter.
function toggleAll(type, el) {
  const list = type === "category" ? categories : audiences;
  const prefix = type === "category" ? "cat" : "aud";
  list.forEach((item) => {
    document.getElementById(`${prefix}-${item}`).checked = el.checked;
  });
  applyFilter();
}

// Expands or collapses a resource card.
// Closes every other card first so only one card is open at a time (accordion behavior).
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

// Slides the right sidebar shut and restores the floating "Show Resources" button.
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

// Returns the HTML for a single resource card.
// One renderer used by every sidebar view; options toggle the card's variants.
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

// Renders a sequence of resource cards using shared options.
function renderResourceList(resources, options) {
  return resources.map((p, i) => renderResourceCard(p, i, options)).join("");
}

/* ════════════════════════════════════════════════
   Main actions
═══════════════════════════════════════════════ */

// Master filter handler. Triggered whenever a checkbox changes.
// 1. Syncs the "Select All" master checkboxes to reflect the new state.
// 2. Re-styles every building polygon (matching → maize, otherwise → dim blue).
// 3. If the sidebar is open, re-renders its list to reflect the new filter.
// 4. Updates the resource count badge.
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

// Updates the number shown on the floating "Show N Resources" button.
function updateResourceCount() {
  document.getElementById("resource-count").textContent =
    getFilteredResources().length;
}

// Opens the right sidebar populated with every resource matching the current filter.
// Triggered by clicking the floating "Show Resources" button.
function toggleResourceList(event) {
  event.stopPropagation();
  document.getElementById("rightbar-button").style.display = "none";
  document.getElementById("rightbar-body").innerHTML = renderResourceList(
    getFilteredResources(),
    { mode: "flyTo" },
  );
  document.getElementById("rightbar").classList.add("open");
}

// Card-click handler for the filtered list view: expand/collapse the card
// AND fly the map to that resource's building so it's visible behind the sidebar.
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

// Flies the map to one of the predefined campus views and highlights its button.
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

// Handles a click on any AI-resource building polygon:
//   - Flies the map to the click point.
//   - Looks up every resource hosted in that building.
//   - Opens the right sidebar with the appropriate detail view:
//       0 matches → "No data found" message
//       1 match   → single fully-expanded card
//       2+ matches→ accordion list of collapsed cards
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

// Build the two filter checkbox lists into the left sidebar.
buildCheckboxes(categories, "category-list", "cat");
buildCheckboxes(audiences, "audience-list", "aud");

// Load the AI resource data (CSV) and refresh the count badge once it's in.
fetch("map-data/resources-edited.csv")
  .then((res) => res.text())
  .then((csvText) => {
    resourceData = parseCSV(csvText).filter((r) => r.resource_name);
    updateResourceCount();
  });

// Load the building footprints (GeoJSON) and draw them on the map.
// Resource buildings get a click handler that opens the right sidebar.
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

// Keep clicks and scroll inside the right sidebar from bubbling up to the map
// (so they don't accidentally close the sidebar or pan the map).
document.getElementById("rightbar").addEventListener("click", (e) => e.stopPropagation());
document.getElementById("rightbar").addEventListener("wheel", (e) => e.stopPropagation());

// Any click on the bare map closes the sidebar.
map.on("click", () => closeRightSidebar());
