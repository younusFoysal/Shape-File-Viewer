
# Shapefile Viewer

This project is a Shapefile Viewer built using React and **OpenLayers (OL)** for rendering geographic data. It allows users to upload Shapefiles (`.shp`, `.dbf`, etc.) or ZIP files containing Shapefile components, visualize them on a map, and add/view notes for specific features.

## Features

- Upload Shapefiles (`.shp`, `.dbf`, `.shx`, `.prj`, `.cpg`) or ZIP files.
- Visualize Shapefile data on an interactive map.
- Add and view notes for specific features.
- Save and load previously uploaded Shapefiles with their associated notes.
- Highlight and zoom to specific features.

## Technologies Used

- **React**: Frontend framework.
- **OpenLayers (OL)**: JavaScript library for rendering maps and geographic data.
- **shpjs**: Library for parsing Shapefiles in the browser.
- **Lucide Icons**: Icon library for UI elements.
- **LocalStorage**: For saving and loading Shapefile data and notes.

## Live Demo

Check out the live demo here: [Shapefile Viewer Live Demo](https://shape-file-viewer-react-js.vercel.app)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/younusFoysal/Shape-File-Viewer.git
   ```
2. Navigate to the project directory:
   ```bash
   cd Shape-File-Viewer
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:5173`.

## Build

To build the project for production, run:
```bash
npm run build
```

## Alternative Map Packages

Here’s a comparison of different npm map packages that could be used instead of OpenLayers:

| **Package**       | **Pros**                                                                 | **Cons**                                                                 |
|--------------------|--------------------------------------------------------------------------|--------------------------------------------------------------------------|
| **OpenLayers**     | - Highly customizable<br>- Supports multiple projections<br>- Extensive feature set for GIS applications | - Steeper learning curve<br>- Larger bundle size<br>- Documentation can be complex |
| **Leaflet**        | - Lightweight and easy to use<br>- Great for simple maps<br>- Large plugin ecosystem | - Limited support for advanced GIS features<br>- Fewer built-in tools for complex data |
| **Mapbox GL JS**   | - High-performance rendering<br>- Beautiful default styles<br>- Built-in support for vector tiles | - Requires API key for advanced features<br>- Limited customization for non-Mapbox data |
| **Google Maps**    | - Familiar interface for users<br>- Extensive documentation<br>- Built-in geocoding and directions | - Requires API key<br>- Limited customization for non-Google data<br>- Costly for high usage |
| **CesiumJS**       | - 3D globe rendering<br>- Supports time-dynamic data<br>- Great for scientific and complex visualizations | - Heavy bundle size<br>- Complex setup for 2D maps<br>- Steeper learning curve |

## Why OpenLayers?

OpenLayers was chosen for this project because of its flexibility and support for advanced GIS features. It allows for rendering Shapefiles directly in the browser and provides tools for handling complex geographic data. While it has a steeper learning curve, it offers the most robust solution for this type of application.

## Future Improvements

- Add support for additional file formats (e.g., GeoJSON, KML).
- Implement 3D visualization using CesiumJS or Mapbox GL JS.
- Add user authentication and cloud storage for saved files.
- Improve performance for large datasets.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

