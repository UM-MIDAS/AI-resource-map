# Introduction
This project maps the locations of AI resources across the three campuses of the University of Michigan — Ann Arbor, Dearborn, and Flint. The goal is to provide an interactive, spatial overview of organizations, labs, and facilities that offer AI-related services and research support across the university. Because these resources are distributed across many departments and buildings, they can be difficult for students, faculty, and researchers to identify and navigate. By visualizing them on a map, the project helps users more easily discover available resources, understand where AI-related activity is distributed across campuses, and identify potential opportunities for collaboration or support.

# Features
- Interactive map centered on the University of Michigan campuses
- Building footprints color-coded by AI resource availability
- Hover tooltip showing building names
- Click on an AI resource building to view organization details on right sidebar
- Filter buildings by service category using a multi-select accordion 
- Campus extent buttons to quickly navigate between campuses

# Framework
The map is built using Leaflet.js, a lightweight open-source JavaScript library for interactive maps. The interface includes a left sidebar for filtering and navigation, and a right sidebar that displays detailed information when a resource building is selected.

# Data
- **Building footprints** — Shapefile provided by the University of Michigan Facilities & Operations Information Services, accessed via ArcGIS Online ([link](https://www.arcgis.com/home/item.html?id=ba25642ae276429b8664dda39ba261e3)). Last updated July 8, 2025.
- **AI resource details** — Custom dataset compiled from University of Michigan departmental websites, research centers, program pages, and surveys. The dataset includes the names of each resource along with information on the specific services and initiatives offered, contact information, street addresses, and consultation hours (if offered). Data was manually collected and standardized to support spatial integration with campus building footprints. This dataset is not an official university dataset and may not be exhaustive.

## How to update the data



## Project Structure
```
um-ai-resource-map/
├── index.html
├── map.js
├── style.css
├── README.md
└── map-data/
    └── um-building-footprint-edited.geojson
    └── resources-edited.csv
```