const urls = {
  basemap: "data/SF Find Neighborhoods.geojson",
  streets: "https://data.sfgov.org/resource/3psu-pn9h.geojson?$limit=8000",
  encampments: "data/311_Cases_rollup.csv"
};

// calculate date range
const end = d3.timeDay.floor(d3.timeDay.offset(new Date(), -1));
const start = d3.timeDay.floor(d3.timeDay.offset(end, -7));
const format = d3.timeFormat("%Y-%m-%dT%H:%M:%S");
console.log(format(start), format(end));


// output url before encoding
console.log(urls.encampments);


const svg = d3.select("body").select("svg#vis");

const g = {
  basemap: svg.select("g#basemap"),
  streets: svg.select("g#streets"),
  outline: svg.select("g#outline"),
  encampments: svg.select("g#encampments"),
  tooltip: svg.select("g#tooltip"),
  details: svg.select("g#details")
};

const data = {};

// setup tooltip (shows neighborhood name)
const tip = g.tooltip.append("text").attr("id", "tooltip");
tip.attr("text-anchor", "end");
tip.attr("dx", -5);
tip.attr("dy", -5);
tip.style("visibility", "hidden");

// add details widget
// https://bl.ocks.org/mbostock/1424037
const details = g.details.append("foreignObject")
  .attr("id", "details")
  .attr("width", config.svg.width)
  .attr("height", config.svg.height)
  .attr("x", 0)
  .attr("y", 0);

const body = details.append("xhtml:body")
  .style("text-align", "left")
  .style("background", "none")
  .html("<p>N/A</p>");

details.style("visibility", "hidden");

// setup projection
// https://github.com/d3/d3-geo#geoConicEqualArea
const projection = d3.geoConicEqualArea();
projection.parallels([37.692514, 37.840699]);
projection.rotate([122, 0]);

// setup path generator (note it is a GEO path, not a normal path)
const path = d3.geoPath().projection(projection);
let radius;
const zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', zoomed);

d3.json(urls.basemap).then(function(json) {
  // makes sure to adjust projection to fit all of our regions
  projection.fitSize([960, 600], json);

  // draw the land and neighborhood outlines
  drawBasemap(json);

  // now that projection has been set trigger loading the other files
  // note that the actual order these files are loaded may differ
  d3.json(urls.streets).then(drawStreets);
  d3.csv(urls.encampments, d3.autoType).then(drawEncampments);
});

function drawBasemap(json) {
  console.log("basemap", json);
  data.neighborhoods = json.features;

  const basemap = g.basemap.selectAll("path.land")
    .data(json.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "land");

  const outline = g.outline.selectAll("path.neighborhood")
    .data(json.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "neighborhood")
    .each(function(d) {
      // save selection in data for interactivity
      // saves search time finding the right outline later
      d.properties.outline = this;
    });

  // add highlight
  basemap.on("mouseover.highlight", function(d) {
      d3.select(d.properties.outline).raise();
      d3.select(d.properties.outline).classed("active", true);
    })
    .on("mouseout.highlight", function(d) {
      d3.select(d.properties.outline).classed("active", false);
    });

  // add tooltip
  basemap.on("mouseover.tooltip", function(d) {
      tip.text(d.properties.name);
      tip.style("visibility", "visible");
    })
    .on("mousemove.tooltip", function(d) {
      const coords = d3.mouse(g.basemap.node());
      tip.attr("x", coords[0]);
      tip.attr("y", coords[1]);
    })
    .on("mouseout.tooltip", function(d) {
      tip.style("visibility", "hidden");
    });
}

function drawStreets(json) {
  console.log("streets", json);

  // only show active streets
  const streets = json.features.filter(function(d) {
    return d.properties.active;
  });

  console.log("removed", json.features.length - streets.length, "inactive streets");

  g.streets.selectAll("path.street")
    .data(streets)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "street");
}

function drawEncampments(json) {
  console.log("encampments", json);
  radius = d3.scaleSqrt([0, d3.max(json, d => d['CaseID'])], [0, 20]);
  // loop through and add projected (x, y) coordinates
  // (just makes our d3 code a bit more simple later)
  json.forEach(function(d) {
    const centroid = path.centroid(data.neighborhoods.filter(v => v.properties["name"] === d['Neighborhood'])[0]);
    d.count = d['CaseID'];
    d.r = radius(d.count);
    d.x = centroid[0];
    d.y = centroid[1];
  });

  const symbols = g.encampments.selectAll("circle")
    .data(json)
    .enter()
    .append("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", d => d.r)
      .attr("class", "symbol")
      .attr("fill", "#7a0177")
      .attr("fill-opacity", 0.5)
      .attr("stroke", "#f768a1")
      .attr("stroke-width", 0.5);

  symbols.on("mouseover", function(d) {
    d3.select(this).raise();
    d3.select(this).classed("active", true);

    // use template literal for the detail table
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
    const html = `
      <table class='table is-narrow'>
      <tbody>
        <tr>
          <th>Neighborhood:</th>
          <td>${d.Neighborhood}</td>
        </tr>
        <tr>
          <th>Count:</th>
          <td>${d.count}</td>
        </tr>
      </tbody>
      </table>
    `;

    body.html(html);
    details.style("visibility", "visible");
  });

  symbols.on("mouseout", function(d) {
    d3.select(this).classed("active", false);
    details.style("visibility", "hidden");
  });
  svg.call(zoom);
}

function zoomed() {
    g.basemap.attr('transform', d3.event.transform);
    g.streets.attr('transform', d3.event.transform);
    g.outline.attr('transform', d3.event.transform);
    g.encampments.attr('transform', d3.event.transform);
    g.tooltip.attr('transform', d3.event.transform);
};
