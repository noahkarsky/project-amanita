
const mouseoverDelay = 0600; // Delay in milliseconds (2000ms = 2 seconds)
const labelThreshold = 2; // Set the zoom threshold for showing/hiding edge labels
// Load the nodes and edges CSV files using d3.csv()

Promise.all([
    d3.csv('../../data/nodes.csv'),
    d3.csv('../../data/edges.csv')
]).then(function (data) {
    var nodes = data[0];
    var edges = data[1];// Define a custom color map
    var colorMap = {
        'program': '#4e79a7',
        'person': '#f28e2c',
        'position': '#e15759',
        'publication': '#76b7b2',
        'event': '#59a14f',
        'place': '#edc948',
        'concept': '#b07aa1',
        'organization': '#ff9da7',
        'group': '#9c755f',
        'date': '#bab0ac',
        'civilian_contractor': '#9467bd',
        'object': '#d37295',
        'technology': '#17becf'
    };



    var svg = d3.select("svg");

    //// Legend items
    var legend = d3.select("#legend");
    // Add a div for each color in the color map
    Object.entries(colorMap).forEach(([key, value]) => {
        var row = legend.append("div")
            .attr("class", "legend-key");

        row.append("div")
            .style("background-color", value)
            .style("width", "12px")
            .style("height", "12px")
            .style("border-radius", "50%");

        row.append("span")
            .text(key);
    });


    ///node and edge properties
    nodes.forEach(function (node) {
        if (node.properties) {
            try {
                node.properties = JSON.parse(node.properties);
                node.name = node.properties.properties.name; // Change this line
            } catch (e) {
                console.error(`Error parsing properties for node ${node.id}: ${e}`);
            }
        } else {
            console.error(`Node ${node.id} has undefined properties`);
        }
        console.log(node.name); // Add this line to check the name value
    });

    edges.forEach(function (edge) {
        if (edge.properties) {
            edge.properties = JSON.parse(edge.properties);
            edge.type = edge.properties.type; // Extract the type from the properties
            if (edge.properties.properties) {
                edge.notes = edge.properties.properties.notes; // Extract the notes if available
            }
        }
    });


    var simulation = d3.forceSimulation(nodes)
        .force('collide', d3.forceCollide().radius(30))
        .force('charge', d3.forceManyBody().strength(-150))
        .alphaDecay(0.05)
        .force('link', d3.forceLink(edges).id(function (d) {
            return d.id;
        }).distance(100))
        .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .on('tick', function () {
            tick();
        })
        .on('end', function () {
            if (options.zoomFit && !justLoaded) {
                justLoaded = true;
                zoomFit(2);
            }
        });


    var svg = d3.select('svg')
    var defs = svg.append("defs"); // Add this line
    var g = svg.append("g");

    // Create SVG groups for each edge
    var linkGroup = g.selectAll(".linkGroup")
        .data(edges)
        .join("g")
        .attr("class", "linkGroup");


    // Create paths for each edge
    linkGroup.append("path")
        .attr("class", "link")
        .attr("id", function (d, i) { return `edge-path-${i}`; }) // Add unique ID to each path
        .attr("marker-end", "url(#arrow)"); // Add arrow marker

    // Add this block after creating the defs element
    defs.append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 32) // Set the position of the arrow marker to touch the node
        .attr("refY", 0)
        .attr("markerWidth", 9) // Reduce the markerWidth to make the arrowhead smaller
        .attr("markerHeight", 9) // Reduce the markerHeight to make the arrowhead smaller
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("class", "arrowHead");


    // Add zooming functionality
    var zoom = d3.zoom() // Create the zoom object
        .scaleExtent([0.1, 13]) //this line controls "how much" you can zoom in, lets make it a little more zoomed out

        .on("zoom", zoomed); // This line tells D3 what to do when the zoom event is fired

    svg.call(zoom);


    var highlightTimeout;

    // Create SVG circles for each node
    var node = g.selectAll(".node")
        .data(nodes)
        .join("circle")
        .attr("class", "node")
        .attr("r", 27)
        .attr("fill", function (d) { return colorMap[d.properties.labels]; })
        .on("mouseover", showTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));
    node.on("mouseover", function (event, d) {
        // Clear any existing timeout
        clearTimeout(highlightTimeout);
        // Set a new timeout to call the highlight function after a delay
        highlightTimeout = setTimeout(function () {
            showTooltip(event, d);
            highlightConnectedNodes(event, d);
        }, mouseoverDelay);
    })
        .on("mouseout", function (event, d) {
            // Clear the timeout if the mouse leaves before the delay
            clearTimeout(highlightTimeout);
            hideTooltip(event, d);
            resetOpacity();
        });

    var label = g.selectAll(".label")
        .data(nodes)
        .join("text")
        .attr("class", "label")
        .attr("x", function (d) {
            return d.x;
        })
        .attr("y", function (d) {
            return d.y;
        })
        .each(function (d) {
            var maxLengthPerLine = 10;
            var maxLengthTotal = 30;
            var words = d.name.split(' ');
            var line = '';
            var lineNumber = 0;
            var charCount = 0;
            var lineHeight = 1.1; // ems
            var tspan = d3.select(this).append("tspan") // Add first tspan element to label text this 
                .attr("x", function () { // Set the x position
                    return d.x;
                })
                .attr("y", function () {
                    return d.y;
                })
                .attr("dy", `${lineHeight - 2}em`);
            words.forEach(function (word, i) {
                if (charCount + word.length <= maxLengthTotal) {
                    var testLine = line + word + " ";
                    if (testLine.length > maxLengthPerLine) {
                        tspan.text(line);
                        line = word + " ";
                        lineNumber += 1;
                        tspan = d3.select(tspan.node().parentNode).append("tspan")
                            .attr("x", function () { // Set the x position 
                                return d.x;
                            })
                            .attr("y", function () {
                                return d.y;
                            })
                            .attr("dy", `${(lineNumber + 1) * lineHeight - 2}em`)
                            .text(line);
                    } else {
                        line = testLine;
                    }
                    charCount += word.length + 1;
                } else {
                    // If adding the current word will exceed maxLengthTotal
                    if (i === words.length - 1 || charCount + 3 > maxLengthTotal) {
                        tspan.text(line.slice(0, -1) + '...');
                    }
                }
                if (i === words.length - 1 && charCount <= maxLengthTotal) {
                    tspan.text(line);
                }
            });
        });


    // Add event listeners for the label elements
    label.on("mouseover", showTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("mouseover", function (event, d) {
            clearTimeout(highlightTimeout);
            highlightTimeout = setTimeout(function () {
                showTooltip(event, d);
                highlightConnectedNodes(event, d);
            }, mouseoverDelay);
        })
        .on("mouseout", function (event, d) {
            clearTimeout(highlightTimeout);
            hideTooltip(event, d);
            resetOpacity();
        })


    var edgeLabel = linkGroup.append("text")
        .attr("class", "edgeLabel")
        .append("textPath")
        .attr("startOffset", "50%")
        .attr("text-anchor", "middle")
        .attr("xlink:href", function (d, i) { return `#edge-path-${i}`; })
        .attr("dy", function (d) {
            var angle = Math.atan2(d.target.y - d.source.y, d.target.x - d.source.x) * 180 / Math.PI;
            return (angle > 90 || angle < -90) ? "-0.4em" : "1.2em";
        })
        .text(function (d) { return d.type; });

    var linkedByIndex = {};
    edges.forEach(function (d) {
        linkedByIndex[`${d.source},${d.target}`] = 1;
    });


    // Update the visualization on each tick of the simulation
    simulation.on("tick", function () {
        linkGroup.select(".link").attr("d", function (d) {
            return "M" + d.source.x + "," + d.source.y + " L" + d.target.x + "," + d.target.y;
        });


        node
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })

        label
            .attr('x', function (d) { return d.x; }) // Adjust the position of the text
            .attr('y', function (d) { return d.y; })  // Adjust the position of the text
            .selectAll("tspan") // Select all tspan elements inside the labels
            .attr("x", function (d) { return d.x; }) // Update the x position of the tspan elements
            .attr("y", function (d) { return d.y; }); // Update the y position of the tspan elements

        edgeLabel
            .attr("x", function (d) { return (d.source.x + d.target.x) / 2; })
            .attr("y", function (d) { return (d.source.y + d.target.y) / 2; })
            .text(function (d) { return d.type; });
    });


    /////functions

    // Drag and zoom functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = d.x;
        d.fy = d.y;
    }
    // Zoom function
    function zoomed(event) {
        g.attr("transform", event.transform);

        // Show or hide edge labels based on highlighting and zoom scale
        if (event.transform.k >= labelThreshold) {
            linkGroup.selectAll(".edgeLabel").style("display", "block");
        } else {
            linkGroup.selectAll(".edgeLabel:not(.highlighted-label)").style("display", "none");
        }
    }



    //highlighter and opacity functions
    function highlightConnectedNodes(event, d) {
        node.style("opacity", function (o) {
            return isConnected(d, o) ? 1 : 0.1;
        });

        linkGroup.style("opacity", function (o) {
            return o.source === d || o.target === d ? 1 : 0.1;
        });
        linkGroup.selectAll(".edgeLabel").each(function (o) {
            // If the edge is connected to the node being hovered over or connected to a node that is being hovered over then show the label
            if (o.source === d || o.target === d) {
                d3.select(this).style("display", "block").classed("highlighted-label", true);
            } else {
                d3.select(this).classed("highlighted-label", false);
            }
        });

    }

    function resetOpacity() {
        node.style("opacity", 1);
        linkGroup.style("opacity", 1);
        linkGroup.selectAll(".edgeLabel").each(function () {
            d3.select(this).style("display", "none").classed("highlighted-label", false);
        });
    }

    // Helper function to check if two nodes are connected
    function isConnected(a, b) {
        if (a.id === b.id) return true; // If the nodes are the same, they are connected
        return edges.some(function (edge) {
            return (edge.source.id === a.id && edge.target.id === b.id) || (edge.source.id === b.id && edge.target.id === a.id);
        });
    }


    ///// tooltip functions
    function showTooltip(event, d) {
        d3.select('.tooltip')
            .style('display', 'block')
            .html('<h4>' + d.name + '</h4>'
                + '<p><strong>Notes:</strong> ' + (d.properties.properties.notes || 'N/A') + '</p>'
                + '<p><strong>Start Date:</strong> ' + (d.properties.properties.start_date || 'N/A') + '</p>'
                + '<p><strong>End Date:</strong> ' + (d.properties.properties.end_date || 'N/A') + '</p>')
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px');

        // Highlight the connected nodes
        node.style('opacity', function (node_d) {
            return isConnected(d, node_d) ? 1 : 0.2;
        });
        label.style('opacity', function (node_d) {
            return isConnected(d, node_d) ? 1 : 0.2;
        });
        linkGroup.style('opacity', function (link_d) {
            return link_d.source === d || link_d.target === d ? 1 : 0.2;
        });
    }

    function moveTooltip(event) {
        d3.select('.tooltip')
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px');
    }

    function hideTooltip() {
        d3.select('.tooltip')
            .style('display', 'none');
        // Reset the opacity of the nodes and links
        node.style('opacity', 1);
        label.style('opacity', 1);
        linkGroup.style('opacity', 1);
    }
})