/* ════════════
   Constants
════════════ */

// Types of resources or services offered by each unit.
// Order here = display order in the "Filter by Resource Type" list.
// Must match the values used in resource_new.csv exactly.
const resourceTypes = [
  "Funding & Project Development",
  "Computing Infrastructure",
  "Data, Software & Technical Tools",
  "Consulting & Technical Support",
  "Training & Education",
  "Research Collaboration",
  "Methods & Research Support",
];

// Fields or domains to which each resource applies.
// Order here = display order in the "Filter by Thematic Area" list.
const thematicAreas = [
  "AI & Machine Learning",
  "Data Science & Statistics",
  "Robotics & Autonomy",
  "Health",
  "Ethics, Society & Policy",
  "Arts, Humanities & Creative Practice",
  "Education",
  "Physical Sciences & Engineering",
  "Human-Computer Interaction",
];

// Audience groups used to tag each AI resource.
const audiences = [
  "Faculty",
  "Undergraduate",
  "Graduate",
  "Staff",
  "Researcher",
  "U-M Community"
];


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

// Create the Leaflet map and add the Stadia basemap tiles.
// minZoom keeps users from zooming out far enough to see repeated/tiled
// copies of the world map — there's nothing useful below "see all of
// Michigan" for a campus resource map.
const map = L.map("map", { minZoom: 9 }).setView(extents.central.center, extents.central.zoom);

L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
	minZoom: 0,
	maxZoom: 20,
	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	ext: 'png'
}).addTo(map);



/* ════════════
   State
════════════ */

// The Leaflet GeoJSON layer holding all building polygons (set once data loads).
let geojsonLayer = null;

// Array of resource objects parsed from resource_new.csv (set once data loads).
let resourceData = [];

/* ════════════
   Helpers
════════════ */

// Parses a CSV string into an array of objects keyed by header name.
// RFC4180-aware: handles quoted fields containing commas, escaped ("")
// quotes, and embedded newlines — row boundaries are only recognized
// outside of quotes, so a newline inside a quoted field does not
// fracture the record.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  const pushValue = () => {
    row.push(current.trim());
    current = "";
  };
  const pushRow = () => {
    pushValue();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++; // skip the escaped quote's second character
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushValue();
    } else if (char === "\r") {
      // ignore; the following \n (if any) terminates the row
    } else if (char === "\n") {
      pushRow();
    } else {
      current += char;
    }
  }
  // Final field/row, for files with no trailing newline.
  if (current !== "" || row.length > 0) pushRow();

  // Drop a trailing fully-empty row produced by a trailing newline in the file.
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }

  const headers = rows[0];
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((h, i) => [h, values[i] || ""])),
  );
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
  const selectedCats = resourceTypes.filter(
    (c) => document.getElementById(`rtp-${c}`).checked,
  );
  const selectedAuds = audiences.filter(
    (a) => document.getElementById(`aud-${a}`).checked,
  );
  const selectedThemes = thematicAreas.filter(
    (t) => document.getElementById(`thm-${t}`).checked,
  );
  return {
    selectedCats,
    selectedAuds,
    selectedThemes,
    allCatsSelected: selectedCats.length === resourceTypes.length,
    allAudsSelected: selectedAuds.length === audiences.length,
    allThemesSelected: selectedThemes.length === thematicAreas.length,
  };
}

// Returns true if a resource's category + audience + thematic area tags satisfy
// the active filters. When all checkboxes in a group are selected, that group
// is treated as a pass-through.
function matchesFilter(cats, auds, themes, filters) {
  const {
    selectedCats,
    selectedAuds,
    selectedThemes,
    allCatsSelected,
    allAudsSelected,
    allThemesSelected,
  } = filters;
  const catMatch =
    allCatsSelected ||
    (selectedCats.length > 0 && cats.some((s) => selectedCats.includes(s)));
  const audMatch =
    allAudsSelected ||
    (selectedAuds.length > 0 && auds.some((s) => selectedAuds.includes(s)));
  const themeMatch =
    allThemesSelected ||
    (selectedThemes.length > 0 && themes.some((s) => selectedThemes.includes(s)));
  return catMatch && audMatch && themeMatch;
}

// Returns the subset of resourceData that matches the current filter state.
// Single source of truth for the sidebar list and the resource count badge.
function getFilteredResources() {
  const filters = getSelectedFilters();
  return resourceData.filter((p) =>
    matchesFilter(
      parseList(p.category),
      parseList(p.audience),
      parseList(p.thematic_area),
      filters,
    ),
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

// Expands or collapses a filter group's dropdown panel.
// `label` is the clicked .filter-list-label; its panel is the next sibling element.
function toggleFilterList(label) {
  label.classList.toggle("open");
  label.nextElementSibling.classList.toggle("open");
}

// Resets every filter checkbox back to checked (category, audience, thematic
// area, and the three "Select All" boxes) — i.e. clears any active filtering
// so every resource shows again — then re-applies.
function clearFilters() {
  document.querySelectorAll('#filter-section input[type="checkbox"]').forEach((cb) => {
    cb.checked = true;
  });
  applyFilter();
}

// Handler for the "Select All" checkbox in each filter group.
// Mirrors the master checkbox state onto every child checkbox, then re-applies the filter.
function toggleAll(type, el) {
  const lists = { category: resourceTypes, audience: audiences, thematic: thematicAreas };
  const prefixes = { category: "rtp", audience: "aud", thematic: "thm" };
  const list = lists[type];
  const prefix = prefixes[type];
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
   ─ open:  start with card body visible (no display:none)
   ─ mode:  "flyTo"  → click flies map to the building
            "toggle" → click just expands/collapses the card
═══════════════════════════════════════════════ */

// Returns the HTML for a single resource card.
// One renderer used by every sidebar view; options toggle the card's variants.
function renderResourceCard(p, i, { open = false, mode = "toggle" } = {}) {
  const onClickAttr =
    mode === "flyTo"
      ? `openResourceCard(${i}, '${p.building_id}')`
      : `toggleCard(${i})`;
  const bodyStyle = open ? "" : 'style="display:none;"';

  // Phone is optional — only render the row if a value is present.
  const phoneRow = p.phone
    ? `<div class="info-row"><span class="info-label">Phone</span>${p.phone}</div>`
    : "";

  // Tag (e.g. "Program", "Lab") lives inside the header and is shown/hidden
  // via CSS based on the header's .active class — no extra JS needed.
  const tagBadge = p.tag
    ? `<span class="card-type-tag">${p.tag}</span>`
    : "";

  return `
    <div class="toggle-card">
      <div class="toggle-card-header ${open ? "active" : ""}" onclick="${onClickAttr}">
        <span>${p.resource_name || "Unknown"}</span>
        ${tagBadge}
      </div>
      <div class="toggle-card-body" id="card-${i}" ${bodyStyle}>
        <div class="info-desc">${p.description || ""}</div>
        <div class="info-row">
          <span class="info-label">Address</span>
          ${p.address || ""}${p.building_room ? `<div>${p.building_room}</div>` : ""}
        </div>
        <div class="info-row"><span class="info-label">Email</span><a href="mailto:${p.email}">${p.email || ""}</a></div>
        ${phoneRow}
        <div class="info-row"><span class="info-label">Website</span><a href="${p.url}" target="_blank">${p.url || ""}</a></div>
        <div class="info-row">
          <span class="info-label">Resource Type</span>
          <div class="filter-tags">
            ${parseList(p.category).map((s) => `<span class="filter-tag">${s}</span>`).join("")}
          </div>
        </div>
        <div class="info-row">
          <span class="info-label">Audience</span>
          <div class="filter-tags">
            ${parseList(p.audience).map((s) => `<span class="filter-tag">${s}</span>`).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Renders a sequence of resource cards using shared options.
// If the list contains a mix of on-campus (has building_id) and
// off-campus/remote (no building_id) resources, they are split into
// two groups with a labeled divider between them.
function renderResourceList(resources, options) {
  const physical = resources.filter((r) => r.building_id);
  const remote   = resources.filter((r) => !r.building_id);

  // Single group — no divider needed.
  if (!physical.length || !remote.length) {
    return resources.map((p, i) => renderResourceCard(p, i, options)).join("");
  }

  const divider = `
    <div class="resource-list-divider">
      <span>Remote ↑</span>
    </div>
  `;

  // Assign each card a stable index across both groups so card IDs don't clash.
  const remoteHtml   = remote.map((p, i) => renderResourceCard(p, i, options)).join("");
  const physicalHtml = physical.map((p, i) => renderResourceCard(p, remote.length + i, options)).join("");

  return remoteHtml + divider + physicalHtml;
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
  const { allCatsSelected, allAudsSelected, allThemesSelected } = filters;

  document.getElementById("rtp-all").checked = allCatsSelected;
  document.getElementById("aud-all").checked = allAudsSelected;
  document.getElementById("thm-all").checked = allThemesSelected;

  if (geojsonLayer) {
    geojsonLayer.eachLayer((layer) => {
      const props = layer.feature.properties;
      if (!props.is_resource) return;

      // Color by whether ANY resource hosted in this building matches the
      // active filters. Matching is derived live from resourceData (the CSV)
      // rather than from category/audience baked into the geojson itself —
      // those embedded copies are stale/incomplete and have no thematic_area
      // equivalent, so the CSV is the single source of truth here.
      const buildingId = String(props.building_id);
      const hosted = resourceData.filter((r) => r.building_id === buildingId);
      const match = hosted.some((r) =>
        matchesFilter(
          parseList(r.category),
          parseList(r.audience),
          parseList(r.thematic_area),
          filters,
        ),
      );

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
      open: true,
      mode: "toggle",
    });
  } else {
    document.getElementById("rightbar-button").style.display = "none";
    body.innerHTML = renderResourceList(matches, {
      mode: "toggle",
    });
  }

  sidebar.classList.add("open");
}

/* ════════════════════════════════════════════════
   Bootstrap: build UI, load data, wire events
═══════════════════════════════════════════════ */

// Build the three filter checkbox lists into the left sidebar.
buildCheckboxes(resourceTypes, "resource-list", "rtp");
buildCheckboxes(audiences, "audience-list", "aud");
buildCheckboxes(thematicAreas, "thematic-list", "thm");

// Load the AI resource data (CSV) and refresh the count badge once it's in.
fetch("map-data/resource_new.csv")
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
