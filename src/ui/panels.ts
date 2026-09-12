/**
 * The panels, re-exported.
 *
 * This file used to hold all of them — forty kilobytes of station, meeting,
 * legislation, budget, crisis, report, dashboard and ending code in one
 * module. They now live in `./panels/`, one concern each, and this is the
 * barrel that keeps every existing import working.
 */

export { PanelHost, chips, panel, statLine, band, bandLow } from "./panels/host.ts";
export { stationPanel, familyRoster } from "./panels/station.ts";
export { conversationPanel } from "./panels/meeting.ts";
export { billsPanel, budgetPanel } from "./panels/legislation.ts";
export { crisisPanel, reportPanel } from "./panels/report.ts";
export { dashboardPanel } from "./panels/dashboard.ts";
export { reelectionPanel, endingPanel } from "./panels/decisions.ts";
export { arcPanel } from "./panels/arc.ts";
