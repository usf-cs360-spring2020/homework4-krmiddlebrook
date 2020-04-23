function node_link(data) {

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

  archy.sort(function(a, b) {
    return b.height - a.height || b.count - a.count;
  });
  console.log('hierarchy', archy);


  // define variables for circular dendogram w/curved edges diagram
  const diameter = 500;
  const pad = 14;
  const layout = d3.cluster().size([2 * Math.PI, (diameter / 2) - pad]);

  // define color scales for different depths (i.e. groups)
  const color = {
    base: d3.scaleSequential([archy.height, 0], d3.interpolateViridis),
    lockdown: d3.scaleOrdinal(['Pre-Lockdown', 'Lockdown'], ['blue', 'red'])
  };


  let radialLine = d3.linkRadial()
    .angle(d => d.theta + Math.PI / 2) // rotate, 0 angle is mapped differently here
    .radius(d => d.radial);

  // select node-link svg and retrieve width, height attributes
  let svg = d3.select('#node-link'),
    width = +svg.node().getBoundingClientRect().width,
    height = +svg.node().getBoundingClientRect().height;

  // define plot area
  let plot = svg.append("g")
    .attr("id", "plot")
    .attr("transform", translate(width / 2, height / 2));

  /* Code below is modified from:
      https://observablehq.com/@sjengle/java-11-api-hierarchy-visualization
  */

  // set node-link layout
  layout(archy);

  // set node x, y position
  archy.each(function(node) {
    node.theta = node.x;
    node.radial = node.y;

    let point = toCartesian(node.radial, node.theta);
    node.x = point.x;
    node.y = point.y;
  });

  // draw nodes and links
  drawLinks(plot.append("g"), archy.links(), radialLine);
  drawNodes(plot.append("g"), archy.descendants(), true);


  /* Helper Functions
   */
  function toCartesian(r, theta) {
    return {
      x: r * Math.cos(theta),
      y: r * Math.sin(theta)
    };
  }

  function translate(x, y) {
    return 'translate(' + String(x) + ',' + String(y) + ')';
  }

  function drawLinks(g, links, generator) {
    let paths = g.selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('d', generator)
      .attr('class', 'link');
  }

  function drawNodes(g, nodes, raise) {
    // console.log(nodes);
    let circles = g.selectAll('circle')
      .data(nodes, node => node.data.key)
      .enter()
      .append('circle')
        .attr('r', 5)
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('id', d => d.data.key)
        .text(d => d.data.key)
        .attr('class', 'node')
        .style('fill', d => d.data.key==='Pre-Lockdown' || d.data.key==='Lockdown' ?
          'red' : color.base(d.depth))
        .style('stroke', 'black')

    // remove empty circles
    let remove = circles.filter(d => (d.data.key === "")).remove()

    setupEvents(g, circles);
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
    .attr('transform', translate(width-150, height-500));

  // City (i.e., root)
  let l_city = legend.append('g')
    .attr('id', 'legend-city')
    .attr('transform', translate(0, 15*1));
  l_city.append("circle")
    .attr("x", 0)
    .attr("y", 0)
    .attr("r", 5)
    .style("fill", "#FDE725")
    .style("stroke", "black");
  l_city.append("text")
    .attr("class", "legend-text")
    .attr("x", 10)
    .attr("y", 0)
    .text("City")
    .attr("alignment-baseline", "middle");

  // Lockdown
  let l_lockdown = legend.append('g')
    .attr('id', 'legend-lockdown')
    .attr('transform', translate(0, 15*2));
  l_lockdown.append("circle")
    .attr("x", 0)
    .attr("y", 0)
    .attr("r", 5)
    .style("fill", "red")
    .style("stroke", "black");
  l_lockdown.append("text")
    .attr("class", "legend-text")
    .attr("x", 10)
    .attr("y", 0)
    .text("Lockdown")
    .attr("alignment-baseline", "middle");

  // Call Type Group
  let l_callTypeGroup = legend.append('g')
    .attr('id', 'legend-callTypeGroup')
    .attr('transform', translate(0, 15*3));
  l_callTypeGroup.append("circle")
      .attr("x", 0)
      .attr("y", 0)
      .attr("r", 5)
      .style("fill", "#21918C")
      .style("stroke", "black");
  l_callTypeGroup.append("text")
      .attr("class", "legend-text")
      .attr("x", 10)
      .attr("y", 0)
      .text("Call Type Group")
      .attr("alignment-baseline", "middle");

  // Call Type
  let l_callType = legend.append('g')
    .attr('id', 'legend-callType')
    .attr('transform', translate(0, 15*4));
  l_callType.append("circle")
      .attr("x", 0)
      .attr("y", 0)
      .attr("r", 5)
      .style("fill", "#3B528B")
      .style("stroke", "black");
  l_callType.append("text")
      .attr("class", "legend-text")
      .attr("x", 10)
      .attr("y", 0)
      .text("Call Type")
      .attr("alignment-baseline", "middle");

  // Neighborhood
  let l_neighborhood = legend.append('g')
    .attr('id', 'legend-neighborhood')
    .attr('transform', translate(0, 15*5));
  l_neighborhood.append("circle")
      .attr("x", 0)
      .attr("y", 0)
      .attr("r", 5)
      .style("fill", "#3C034A")
      .style("stroke", "black")
  l_neighborhood.append("text")
      .attr("class", "legend-text")
      .attr("x", 10)
      .attr("y", 0)
      .text("Neighborhood")
      .attr("alignment-baseline", "middle")















}
