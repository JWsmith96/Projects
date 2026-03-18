// Declare the chart dimensions and margins.
const margin = { top: 30, right: 30, bottom: 40, left: 50 };
const width = 900 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Declare the x & y scale.
const x = d3.scaleTime()
    .range([0, width]);

const y = d3.scaleLinear()
    .range([height, 0]);

// Create the SVG element & append to graph container
const svg = d3.select("#graph-container")
    .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

// Create/get dataset
const dataset = [
    { date: new Date("2022-01-01"), value: 200 },
    { date: new Date("2022-02-01"), value: 250 },
    { date: new Date("2022-03-01"), value: 180 },
    { date: new Date("2022-04-01"), value: 300 },
    { date: new Date("2022-05-01"), value: 280 },
    { date: new Date("2022-06-01"), value: 220 },
    { date: new Date("2022-07-01"), value: 300 },
    { date: new Date("2022-08-01"), value: 450 },
    { date: new Date("2022-09-01"), value: 280 },
    { date: new Date("2022-10-01"), value: 600 },
    { date: new Date("2022-11-01"), value: 780 },
    { date: new Date("2022-12-01"), value: 320 }
];

// Define x & y domains (what data will fit into previously declared range)
x.domain(d3.extent(dataset, d => d.date));
y.domain([0, d3.max(dataset, d => d.value)]);

// Add the x-axis
svg.append("g")
    .attr("transform", `translate(0,${height})`)  // Moves axis to the bottom
    .call(d3.axisBottom(x)
        .ticks(d3.timeMonth.every(1))  // what will be on the axis
        .tickFormat(d3.timeFormat("%b %Y")));  // Formats how the axis will be displayed, Jan 2022

// Add the y-axis
svg.append("g")
    .call(d3.axisLeft(y));

// Create the line generator
const line = d3.line()
    .x(d => x(d.date))  // X of the line is the dates
    .y(d => y(d.value));  // Y of the line is from the values 

// Add the line to the SVG element
svg.append("path")
    .datum(dataset)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 1)
    .attr("d", line)