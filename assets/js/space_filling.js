function space_filling(data) {

  // prepare data for d3 hierarchy
  const nested = d3.nest()
    .key(d => d['City'])
    .key(d => d['Lockdown'])
    .key(d => d["Call Type Group"])
    .key(d => d["Call Type"])
    .key(d => d["Neighborhood"])
    .rollup(v => v.length)
    .entries(data);


  console.log('nested', nested);

  // define root node
  const root = nested[0].key;
  console.log("root", root);

  // pass data
  const archy = d3.hierarchy(nested[0], d => d.values);
  archy.count()
  archy.sum(d => d.value);
  archy.sort((a, b) => b.value - a.value);

  // archy.sum(d => d.value);

  console.log('hierarchy', archy);

  /* define variables for circular dendogram w/curved edges diagram */

  // select node-link svg and retrieve width, height attributes
  const svg = d3.select('#space-filling'),
    width = +svg.node().getBoundingClientRect().width,
    height = +svg.node().getBoundingClientRect().height;

  // define plot area
  const plot = svg.append("g")
    .attr("id", "plot")
    .attr("transform", translate(width / 2, height / 2));

  const diameter = 500;
  const pad = 14;
  const radius = width / 3;
  const format = d3.format(",d");

  const layout = d3.partition().size([2 * Math.PI, radius]);

  // define color scales for different depths (i.e. groups)
  const color = {
    base: d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, archy.children.length + 1)),
    lockdown: d3.scaleOrdinal(['Pre-Lockdown', 'Lockdown'], ['blue', 'red'])
  };

  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius / 2)
    .innerRadius(d => d.y0)
    .outerRadius(d => d.y1 - 1);


  // set space filling layout
  layout(archy);

  // inspired by: https://observablehq.com/@d3/sunburst
  // draw arc cells
  plot.append("g")
      .attr("fill-opacity", 0.6)
    .selectAll("path")
    .data(archy.descendants().filter(d => d.depth))
    .join("path")
      .attr("fill", d => { while (d.depth > 1) d = d.parent; return color.base(d.data.key); })
      .attr("d", arc)
    .append("title")
      .text(d => `${d.ancestors().map(d => d.data.key).reverse().join("/")}\n${format(d.value)}`);

  // draw labels
  plot.append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .attr("font-size", 9)
    .attr("font-family", "sans-serif")
  .selectAll("text")
  .data(archy.descendants().filter(d => d.depth && (d.y0 + d.y1) / 2 * (d.x1 - d.x0) > 10))
  .join("text")
    .attr("transform", function(d) {
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
      const y = (d.y0 + d.y1) / 2;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    })
    .attr("dy", "0.35em")
    .text(d => d.data.key);


  function translate(x, y) {
    return 'translate(' + String(x) + ',' + String(y) + ')';
  }



  function setupEvents(g, selection) {

    function showTooltip(g, node) {
      let gbox = g.node().getBBox(); // get bounding box of group BEFORE adding text
      let nbox = node.node().getBBox(); // get bounding box of node

      // calculate shift amount
      let dx = nbox.width / 2;
      let dy = nbox.height / 2;

      // retrieve node attributes (calculate middle point)
      let x = nbox.x + dx;
      let y = nbox.y + dy;

      // get data for node
      let datum = node.datum();

      let name = datum.data.key;

      // use node name and total size as tooltip text
      numberFormat = d3.format(".2~s");
      let text = `${name} (${numberFormat(datum.value)} cases)`;

      // create tooltip
      let tooltip = g.append('text')
        .text(text)
        .attr('x', x)
        .attr('y', y)
        .attr('dy', -dy - 4) // shift upward above circle
        .attr('text-anchor', 'middle') // anchor in the middle
        .attr('id', 'tooltip');

      // get bounding box for the text
      let tbox = tooltip.node().getBBox();

      // if text will fall off left side, anchor at start
      if (tbox.x < gbox.x) {
        tooltip.attr('text-anchor', 'start');
        tooltip.attr('dx', -dx); // nudge text over from center
      }
      // if text will fall off right side, anchor at end
      else if ((tbox.x + tbox.width) > (gbox.x + gbox.width)) {
        tooltip.attr('text-anchor', 'end');
        tooltip.attr('dx', dx);
      }

      // if text will fall off top side, place below circle instead
      if (tbox.y < gbox.y) {
        tooltip.attr('dy', dy + tbox.height);
      }
    }

    // show tooltip text on mouseover (hover)
    selection.on('mouseover.tooltip', function(d) {
      showTooltip(g, d3.select(this));

      // create a filter for only last line of circles
      if (d.height === 0 || d.height === 1 || d.height === 2) {
        selection.filter(e => (d.data.key !== e.data.key))
          .transition()
          .duration(500)
          .attr("fill-opacity", "0.1")
          .style("stroke", "")
      }
    })

    // remove tooltip text on mouseout
    selection.on('mouseout.tooltip', function(d) {
      selection
        .transition()
        .attr("fill-opacity", "1")
        .style('stroke', 'black');
      g.select("#tooltip").remove();
    });
  }

  /* add legend */
  let legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', translate(width-100, height-550));

  // pre-lockdown
  let l_prelockdown = legend.append('g')
    .attr('id', 'legend-city')
    .attr('transform', translate(0, 15*1));
  l_prelockdown.append("circle")
    .attr("x", 0)
    .attr("y", 0)
    .attr("r", 5)
    .style("fill", "#D0F69C")
    .style("stroke", "black");
  l_prelockdown.append("text")
    .attr("class", "legend-text")
    .attr("x", 10)
    .attr("y", 0)
    .text("Pre-Lockdown")
    .attr("alignment-baseline", "middle");

  // lockdown
  let l_lockdown = legend.append('g')
    .attr('id', 'legend-lockdown')
    .attr('transform', translate(0, 15*2));
  l_lockdown.append("circle")
    .attr("x", 0)
    .attr("y", 0)
    .attr("r", 5)
    .style("fill", "#A88CCC")
    .style("stroke", "black");
  l_lockdown.append("text")
    .attr("class", "legend-text")
    .attr("x", 10)
    .attr("y", 0)
    .text("Lockdown")
    .attr("alignment-baseline", "middle");



}
