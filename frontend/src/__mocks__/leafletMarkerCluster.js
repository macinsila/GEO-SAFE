const React = require("react");
const MarkerClusterGroup = ({ children }) =>
  React.createElement("div", { "data-testid": "marker-cluster" }, children);
MarkerClusterGroup.default = MarkerClusterGroup;
module.exports = MarkerClusterGroup;
module.exports.default = MarkerClusterGroup;
