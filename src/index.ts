#!/usr/bin/env node

/**
 * IRS Taxpayer MCP Server — Streamable HTTP Transport
 *
 * A Model Context Protocol server for individual US taxpayers.
 * All tax calculations run locally (no PII leaves the machine).
 *
 * Transports:
 *   Streamable HTTP (default): POST /mcp — stateless, Railway-ready
 *   stdio:                     npx irs-taxpayer-mcp --stdio
 *
 * @see https://modelcontextprotocol.io
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTaxCalculationTools } from "./tools/tax-calculation-tools.js";
import { registerDeductionTools } from "./tools/deduction-tools.js";
import { registerIrsLookupTools } from "./tools/irs-lookup-tools.js";
import { registerCreditTools } from "./tools/credit-tools.js";
import { registerStateTaxTools } from "./tools/state-tax-tools.js";
import { registerPlanningTools } from "./tools/planning-tools.js";
import { registerObbbTools } from "./tools/obbb-tools.js";
import { registerComprehensiveTools } from "./tools/comprehensive-tools.js";
import { registerAdvancedTools } from "./tools/advanced-tools.js";
import { registerSmartTools } from "./tools/smart-tools.js";
import http from "node:http";

const TOOL_COUNT = 39;

function createServer(): McpServer {
  const server = new McpServer({
    name: "irs-taxpayer-mcp",
    version: "0.5.3",
    description:
      "Tax calculation, credits, deductions, state taxes, and retirement strategy tools for individual US taxpayers. " +
      "All financial calculations run locally — your income data never leaves your machine.",
  });

  // Register all tool groups
  registerTaxCalculationTools(server);   // 6 tools
  registerDeductionTools(server);        // 2 tools
  registerIrsLookupTools(server);        // 3 tools
  registerCreditTools(server);           // 5 tools
  registerStateTaxTools(server);         // 4 tools
  registerPlanningTools(server);         // 6 tools
  registerObbbTools(server);             // 2 tools
  registerComprehensiveTools(server);    // 6 tools
  registerAdvancedTools(server);         // 5 tools
  registerSmartTools(server);            // 3+ tools

  return server;
}

// ---------------------------------------------------------------------------
// Transport: Streamable HTTP (stateless, one server per request)
// ---------------------------------------------------------------------------
async function startStreamableHTTP(port: number): Promise<void> {
  const httpServer = http.createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        tools: TOOL_COUNT,
        transport: "streamable-http",
        endpoint: "/mcp",
      }));
      return;
    }

    // Root redirect hint
    if (req.url === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        name: "irs-taxpayer-mcp",
        version: "0.5.3",
        transport: "streamable-http",
        endpoint: "/mcp",
        health: "/health",
        tools: TOOL_COUNT,
        docs: "POST JSON-RPC to /mcp. See https://modelcontextprotocol.io",
      }));
      return;
    }

    // --- MCP endpoint: /mcp ---
    if (req.url === "/mcp") {
      // Stateless mode: create a fresh server + transport per request
      const mcpServer = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless — no session tracking
      });

      // Wire MCP server to transport, then let transport handle the HTTP req/res
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);

      // After the response is sent, clean up
      res.on("close", () => {
        transport.close().catch(() => {});
        mcpServer.close().catch(() => {});
      });
      return;
    }

    // 404 fallback
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Not found",
      hint: "POST JSON-RPC requests to /mcp, or GET /health for status.",
    }));
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.error(
      `IRS Taxpayer MCP server running — Streamable HTTP on http://0.0.0.0:${port}/mcp — ${TOOL_COUNT} tools loaded`
    );
  });
}

// ---------------------------------------------------------------------------
// Transport: stdio (for local CLI use)
// ---------------------------------------------------------------------------
async function startStdio(): Promise<void> {
  const mcpServer = createServer();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error(`IRS Taxpayer MCP server running on stdio — ${TOOL_COUNT} tools loaded`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const useStdio = args.includes("--stdio");
const portIndex = args.indexOf("--port");
const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : parseInt(process.env.PORT || "3000", 10);

async function main(): Promise<void> {
  if (useStdio) {
    await startStdio();
  } else {
    await startStreamableHTTP(port);
  }
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

function printHelp(): void {
  const help = `
irs-taxpayer-mcp v0.5.3 — Tax assistant MCP server for US individual taxpayers

USAGE:
  npx irs-taxpayer-mcp                  Start Streamable HTTP on port 3000 (default)
  npx irs-taxpayer-mcp --port 8080      Start on custom port
  npx irs-taxpayer-mcp --stdio          Start in stdio mode (local CLI)
  npx irs-taxpayer-mcp --help           Show this help

ENDPOINTS:
  POST /mcp          Streamable HTTP MCP endpoint (JSON-RPC)
  GET  /health       Health check
  GET  /             Server info

TOOLS (${TOOL_COUNT}):

  Federal Tax Calculations
    calculate_federal_tax        Full federal tax with AMT, NIIT, QBI, SE tax, CTC
    get_tax_brackets             Tax brackets by filing status and year
    compare_filing_statuses      Compare all 4 filing statuses
    estimate_quarterly_tax       Estimated quarterly payments (1040-ES)
    calculate_total_tax          Combined federal + state + take-home
    calculate_w4_withholding     W-4 form recommendations

  Deductions
    list_deductions              Browse all deductions with rules
    standard_vs_itemized         Compare standard vs itemized

  Credits
    list_tax_credits             20+ federal credits
    check_credit_eligibility     Quick eligibility screening
    calculate_eitc               Precise EITC calculation

  Retirement
    get_retirement_accounts      IRA, Roth, 401k, HSA, 529 details
    get_retirement_strategy      Backdoor Roth, tax-loss harvesting

  Tax Planning
    get_tax_planning_tips        Year-end optimization strategies
    compare_tax_years            TY2024 vs TY2025 differences
    estimate_self_employment_tax Full SE tax breakdown
    analyze_mortgage_tax_benefit Mortgage deduction analysis
    analyze_education_tax_benefits AOTC vs LLC comparison
    compare_mfj_vs_mfs          MFJ vs MFS with restrictions

  State Taxes
    get_state_tax_info           Rates for all 50 states + DC
    estimate_state_tax           State tax estimate
    compare_state_taxes          Multi-state comparison
    list_no_income_tax_states    9 no-tax states

  IRS Info
    get_tax_deadlines            Key IRS dates
    check_refund_status          Refund check guidance
    get_irs_form_info            Common IRS form info

  OBBB Act (2025)
    calculate_obbb_deductions    Tips, overtime, senior, auto loan
    what_changed_between_tax_years Year-over-year diff

  Reports & Analysis
    generate_full_tax_report     Full TurboTax-style report
    process_1099_income          Process multiple 1099 forms
    get_personalized_tax_calendar Personalized deadlines
    analyze_paycheck             Verify paycheck withholding
    simulate_tax_scenario        What-if modeling
    assess_audit_risk            Audit risk scoring

  Advanced
    get_tax_document_checklist   Filing document checklist
    optimize_capital_gains       Investment lot tax optimization
    plan_retirement_withdrawals  Withdrawal order strategy
    plan_multi_year_taxes        3-5 year tax projection
    analyze_relocation_taxes     State relocation analysis

PRIVACY: All calculations run locally. No data leaves your machine.
DATA: TY2024 (Rev. Proc. 2023-34) and TY2025 (OBBB Act).
`;
  console.log(help);
}
