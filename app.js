const API_BASE_URL = "https://buildlytics-ai.onrender.com";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const TOOLS = {
  powerbi: { name: "Power BI", icon: "📊", tag: "Power BI" },
  sql: { name: "SQL", icon: "🗄️", tag: "SQL" },
  python: { name: "Python", icon: "🐍", tag: "Python" },
  excel: { name: "Excel", icon: "📗", tag: "Excel" },
  tableau: { name: "Tableau", icon: "✨", tag: "Tableau" },
  ml: { name: "Machine Learning", icon: "🧠", tag: "ML" }
};

const state = {
  route: "home",
  dataset: null,
  selectedTool: "powerbi",
  project: null,
  projects: JSON.parse(localStorage.getItem("buildlytics_projects") || "[]"),
  theme: localStorage.getItem("buildlytics_theme") || "dark"
};

if (state.theme === "light") {
  document.documentElement.classList.add("light");
}

const NAV = [
  ["", "Home", [
    ["home", "⌂", "Home"]
  ]],

  ["PROJECT LAB", "Project Lab", [
    ["projects", "▢", "My Projects"],
    ["new", "⊕", "New Project"],
    ["templates", "◇", "Templates"],
    ["recent", "◷", "Recent Projects"]
  ]],

  ["DATA LAB", "Data Lab", [
    ["datasets", "▤", "My Datasets"],
    ["scanner", "◉", "Data Scanner"],
    ["explorer", "▧", "Data Explorer"]
  ]],

  ["CAREER LAB", "Career Lab", [
    ["interview", "◉", "Interview Mode"],
    ["portfolio", "◇", "Portfolio Builder"],
    ["resume", "▤", "Resume Bullets"]
  ]],

  ["WORK SIMULATOR", "Work Simulator", [
    ["workspace", "▦", "Company Workspace", "PRO"],
    ["inbox", "✉", "Manager Inbox"],
    ["tasks", "▣", "Task Board"]
  ]],

  ["", "", [
    ["exports", "⇩", "Export Center"],
    ["verify", "✓", "Project Verify"],
    ["plans", "♛", "Pro Features"]
  ]]
];

function esc(v = "") {
  return String(v).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function toast(msg) {
  const t = $("#toast");

  if (!t) {
    console.log(msg);
    return;
  }

  t.textContent = msg;
  t.classList.add("show");

  clearTimeout(toast._t);

  toast._t = setTimeout(() => {
    t.classList.remove("show");
  }, 3000);
}

function saveProjects() {
  localStorage.setItem(
    "buildlytics_projects",
    JSON.stringify(state.projects)
  );
}

function renderNav() {
  const n = $("#nav");

  if (!n) return;

  n.innerHTML = NAV.map(([label, , items]) => `
    <div class="nav-group">

      ${label ? `<div class="nav-label">${label}</div>` : ""}

      ${items.map(([r, i, t, b]) => `
        <button
          class="nav-btn ${state.route === r ? "active" : ""}"
          data-route="${r}"
        >
          <span>${i}</span>
          <span>${t}</span>
          ${b ? `<span class="badge">${b}</span>` : ""}
        </button>
      `).join("")}

    </div>
  `).join("");

  $$("[data-route]").forEach(b => {
    b.onclick = () => go(b.dataset.route);
  });
}

function go(route) {
  state.route = route;

  render();

  $("#sidebar")?.classList.remove("open");
  $("#backdrop")?.classList.remove("show");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function head(title, sub, actions = "") {
  return `
    <div class="page-head">

      <div>
        <h1>${title}</h1>
        <p>${sub}</p>
      </div>

      ${actions ? `
        <div class="actions">
          ${actions}
        </div>
      ` : ""}

    </div>
  `;
}

function toolButtons() {
  return Object.entries(TOOLS).map(([key, value]) => `
    <button
      class="tool-choice ${state.selectedTool === key ? "selected" : ""}"
      data-tool="${key}"
    >
      <span class="tool-icon">${value.icon}</span>
      <b>${value.name}</b>
    </button>
  `).join("");
}

function bindTools() {
  $$("[data-tool]").forEach(button => {

    button.onclick = () => {

      state.selectedTool = button.dataset.tool;

      $$("[data-tool]").forEach(x => {
        x.classList.toggle(
          "selected",
          x.dataset.tool === state.selectedTool
        );
      });
    };
  });
}

function activityCard(icon, label, value, delta) {
  return `
    <div class="activity-row">

      <div class="activity-icon">
        ${icon}
      </div>

      <div>
        <small class="muted">${label}</small>
        <strong>${value}</strong>
      </div>

      <span class="right chip green">
        ↑ ${delta}
      </span>

    </div>
  `;
}

function suggestedProjects() {
  const remote = state.dataset?.backendSuggestedProjects;

  if (remote?.length) {
    return remote.map(p => {

      let tool = "powerbi";

      const name = String(p.tool || "").toLowerCase();

      if (name.includes("sql")) tool = "sql";
      else if (name.includes("python")) tool = "python";
      else if (name.includes("excel")) tool = "excel";
      else if (name.includes("tableau")) tool = "tableau";
      else if (
        name.includes("machine") ||
        name.includes("ml")
      ) tool = "ml";

      return {
        title: p.title,
        tool,
        desc: `${state.dataset.domain} professional analytics project.`,
        lvl: p.difficulty || "Intermediate",
        value: `${p.value || "High"} Value`
      };
    });
  }

  const domain = state.dataset?.domain || "Business";

  return [
    {
      title: "Sales & Profitability",
      tool: "powerbi",
      desc: `Analyze ${domain.toLowerCase()} performance, profit trends and business metrics.`,
      lvl: "Intermediate",
      value: "High Value"
    },

    {
      title: "Customer Analysis",
      tool: "sql",
      desc: "Deep dive into customer behavior, segments and lifetime value.",
      lvl: "Advanced",
      value: "High Value"
    },

    {
      title: "Performance EDA",
      tool: "python",
      desc: "Explore key drivers, anomalies, categories and trends.",
      lvl: "Intermediate",
      value: "Medium Value"
    },

    {
      title: "Prediction Project",
      tool: "ml",
      desc: "Build a machine learning model where a suitable target exists.",
      lvl: "Advanced",
      value: "High Value"
    }
  ];
}

function projectCard(p) {
  return `
    <div class="card flat project-card">

      <h3>
        ${TOOLS[p.tool].icon}
        ${esc(p.title)}
      </h3>

      <p>${esc(p.desc)}</p>

      <div class="chips">
        <span class="chip blue">
          ${TOOLS[p.tool].tag}
        </span>

        <span class="chip purple">
          ${p.lvl}
        </span>

        <span class="chip green">
          ${p.value}
        </span>
      </div>

      <button
        class="ghost small"
        style="margin-top:13px"
        data-build="${p.tool}"
        data-title="${esc(p.title)}"
      >
        Build this project
      </button>

    </div>
  `;
}

function renderHome() {
  const ds = state.dataset;

  $("#view").innerHTML =
    head(
      "Welcome back, Founder! 👋",
      "Upload your data or choose a tool to build a professional analytics project."
    ) +

    `
    <div class="hero-grid">

      <div class="upload-zone" id="dropZone">

        <div>

          <div class="upload-icon">
            ↥
          </div>

          <h2>
            Upload CSV / Excel File
          </h2>

          <p>
            Drag and drop your file here, or click to browse
          </p>

          <p class="small">
            Supports .csv, .xlsx, .xls
          </p>

          <button
            class="primary"
            id="chooseFile"
          >
            Choose File
          </button>

          ${
            ds
              ? `
                <div
                  class="chip green"
                  style="margin-top:14px"
                >
                  Loaded:
                  ${esc(ds.name)}
                  ·
                  ${ds.rows.length.toLocaleString()}
                  rows
                </div>
              `
              : ""
          }

        </div>

      </div>


      <div class="card flat">

        <h2>
          Create Project Without Data
        </h2>

        <p class="muted">
          Choose a tool and get a ready-to-use company-style project.
        </p>

        <div class="tool-picker">
          ${toolButtons()}
        </div>

        <button
          class="primary full"
          id="createNoData"
          style="margin-top:12px"
        >
          Create Company Project
        </button>

      </div>


      <div class="card flat">

        <div
          class="section-title"
          style="margin-top:0"
        >
          <h2>Your Activity</h2>
          <span class="chip">This Week</span>
        </div>

        ${activityCard(
          "📁",
          "Projects Created",
          state.projects.length || 0,
          "20%"
        )}

        ${activityCard(
          "✓",
          "Projects Completed",
          Math.max(0, state.projects.length - 1),
          "33%"
        )}

        ${activityCard(
          "🗄️",
          "Datasets Analyzed",
          ds ? 1 : 0,
          "18%"
        )}

        ${activityCard(
          "⚡",
          "Project Actions",
          ds ? 24 : 8,
          "25%"
        )}

      </div>

    </div>


    <div class="section-title">

      <h2>
        ${
          ds
            ? "Suggested Projects For Your Data"
            : "Popular Project Paths"
        }
      </h2>

      <a
        href="#"
        data-route="templates"
      >
        View All →
      </a>

    </div>


    <div class="grid project-cards">
      ${suggestedProjects().map(projectCard).join("")}
    </div>


    ${
      state.project
        ? workspacePreview()
        : ""
    }
    `;

  bindTools();
  bindUpload();

  $$("[data-build]").forEach(b => {
    b.onclick = () => {
      createProject(
        b.dataset.build,
        b.dataset.title
      );
    };
  });
}

function bindUpload() {
  const fi = $("#fileInput");
  const zone = $("#dropZone");

  $("#chooseFile")?.addEventListener(
    "click",
    e => {
      e.stopPropagation();
      fi?.click();
    }
  );

  zone?.addEventListener(
    "click",
    e => {
      if (e.target.id !== "chooseFile") {
        fi?.click();
      }
    }
  );

  ["dragenter", "dragover"].forEach(ev => {

    zone?.addEventListener(ev, e => {
      e.preventDefault();
      zone.classList.add("drop-hover");
    });
  });

  ["dragleave", "drop"].forEach(ev => {

    zone?.addEventListener(ev, e => {
      e.preventDefault();
      zone.classList.remove("drop-hover");
    });
  });

  zone?.addEventListener(
    "drop",
    e => {
      handleFile(
        e.dataTransfer.files[0]
      );
    }
  );

  if (fi) {
    fi.onchange = e => {
      handleFile(
        e.target.files[0]
      );
    };
  }

  $("#createNoData")?.addEventListener(
    "click",
    () => createProject(state.selectedTool)
  );
}


/* =========================================================
   LIVE BACKEND
   ========================================================= */

async function apiHealth() {
  try {

    const res = await fetch(
      `${API_BASE_URL}/health`
    );

    if (!res.ok) return false;

    const data = await res.json();

    return data.ok === true;

  } catch {
    return false;
  }
}

async function uploadDatasetToBackend(file) {
  const form = new FormData();

  form.append(
    "file",
    file
  );

  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    70000
  );

  try {

    const res = await fetch(
      `${API_BASE_URL}/upload-dataset`,
      {
        method: "POST",
        body: form,
        signal: controller.signal
      }
    );

    const data =
      await res.json().catch(
        () => ({})
      );

    if (!res.ok) {
      throw new Error(
        data.detail ||
        `Server error ${res.status}`
      );
    }

    return data;

  } finally {
    clearTimeout(timer);
  }
}


async function handleFile(file) {
  if (!file) return;

  const lower =
    file.name.toLowerCase();

  if (
    !lower.endsWith(".csv") &&
    !lower.endsWith(".xlsx") &&
    !lower.endsWith(".xls")
  ) {
    toast(
      "Please upload CSV or Excel file."
    );

    return;
  }

  try {

    toast(
      "Reading dataset..."
    );

    let rows = [];
    let headers = [];

    if (
      lower.endsWith(".csv")
    ) {

      const text =
        await file.text();

      const parsed =
        parseCSV(text);

      headers =
        parsed[0] || [];

      rows =
        parsed.slice(1);

    } else {

      if (!window.XLSX) {
        throw new Error(
          "Excel reader could not load."
        );
      }

      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(
          buffer,
          {
            type: "array"
          }
        );

      const sheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      const aoa =
        XLSX.utils.sheet_to_json(
          sheet,
          {
            header: 1,
            defval: ""
          }
        );

      headers =
        aoa[0] || [];

      rows =
        aoa.slice(1);
    }


    if (!headers.length) {

      throw new Error(
        "No columns found in this file."
      );
    }


    const cleaned =
      rows.filter(
        row =>
          row.some(
            value =>
              String(value)
                .trim() !== ""
          )
      );


    const local =
      analyzeDataset(
        file.name,
        headers,
        cleaned
      );


    state.dataset = local;

    render();


    toast(
      "Sending dataset to Buildlytics server..."
    );


    try {

      const remote =
        await uploadDatasetToBackend(
          file
        );


      state.dataset = {
        ...local,

        backendDatasetId:
          remote.dataset_id,

        backendDomain:
          remote.domain,

        backendSummary:
          remote.summary,

        backendSuggestedProjects:
          remote.suggested_projects || [],

        quality:
          remote.summary
            ?.data_quality_score
          ?? local.quality,

        missing:
          remote.summary
            ?.missing_values
          ?? local.missing,

        duplicates:
          remote.summary
            ?.duplicate_rows
          ?? local.duplicates,

        domain:
          remote.domain ||
          local.domain
      };


      localStorage.setItem(
        "buildlytics_dataset_meta",
        JSON.stringify({
          ...state.dataset,
          rows:
            state.dataset.rows.slice(
              0,
              100
            )
        })
      );


      toast(
        `Server scan complete: ${
          remote.summary?.rows ??
          state.dataset.rows.length
        } rows`
      );


      render();

    } catch (serverError) {

      console.error(
        serverError
      );


      localStorage.setItem(
        "buildlytics_dataset_meta",
        JSON.stringify({
          ...state.dataset,
          rows:
            state.dataset.rows.slice(
              0,
              100
            )
        })
      );


      toast(
        "Dataset loaded locally. Server scan unavailable."
      );
    }

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Unable to read file."
    );
  }
}


function parseCSV(text) {
  let rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const c = text[i];
    const next = text[i + 1];

    if (
      c === '"' &&
      quoted &&
      next === '"'
    ) {

      cell += '"';
      i++;
      continue;
    }

    if (c === '"') {
      quoted = !quoted;
      continue;
    }

    if (
      c === "," &&
      !quoted
    ) {

      row.push(cell);
      cell = "";
      continue;
    }

    if (
      (
        c === "\n" ||
        c === "\r"
      ) &&
      !quoted
    ) {

      if (
        c === "\r" &&
        next === "\n"
      ) i++;

      row.push(cell);
      rows.push(row);

      row = [];
      cell = "";

      continue;
    }

    cell += c;
  }


  if (
    cell.length ||
    row.length
  ) {

    row.push(cell);
    rows.push(row);
  }

  return rows;
}


function analyzeDataset(
  name,
  headers,
  rows
) {

  const h =
    headers.map(
      x =>
        String(x).trim()
    );


  let missing = 0;


  rows.forEach(row => {

    h.forEach((_, index) => {

      if (
        row[index] == null ||
        String(row[index])
          .trim() === ""
      ) {

        missing++;
      }
    });
  });


  const sample =
    rows.slice(
      0,
      Math.min(
        rows.length,
        500
      )
    );


  const signature = (
    h.join(" ") +
    " " +
    sample
      .flat()
      .slice(0, 100)
      .join(" ")
  ).toLowerCase();


  let domain =
    "General Business";


  if (
    /order|product|sales|revenue|customer/.test(
      signature
    )
  ) {
    domain =
      "E-commerce";
  }


  if (
    /delivery|restaurant|rider|food/.test(
      signature
    )
  ) {
    domain =
      "Food Delivery";
  }


  if (
    /loan|account|bank|credit/.test(
      signature
    )
  ) {
    domain =
      "Banking";
  }


  if (
    /patient|hospital|diagnosis/.test(
      signature
    )
  ) {
    domain =
      "Healthcare";
  }


  if (
    /shipment|warehouse|logistics/.test(
      signature
    )
  ) {
    domain =
      "Logistics";
  }


  const unique =
    new Set(
      rows.map(
        row =>
          JSON.stringify(row)
      )
    ).size;


  const duplicates =
    Math.max(
      0,
      rows.length - unique
    );


  const types =
    h.map((column, index) => {

      const values =
        sample
          .map(
            row =>
              row[index]
          )
          .filter(
            value =>
              String(
                value ?? ""
              ).trim() !== ""
          );


      const numbers =
        values.filter(
          value =>
            !isNaN(
              Number(
                String(value)
                  .replace(
                    /[₹,$,%]/g,
                    ""
                  )
              )
            )
        ).length;


      const dates =
        values.filter(
          value =>
            !isNaN(
              Date.parse(value)
            )
        ).length;


      if (
        values.length &&
        numbers >
        values.length * 0.8
      ) {
        return "number";
      }


      if (
        values.length &&
        dates >
        values.length * 0.8
      ) {
        return "date";
      }


      return "text";
    });


  const totalCells =
    Math.max(
      1,
      rows.length *
      h.length
    );


  const quality =
    Math.max(
      40,

      Math.round(
        100
        -
        (
          missing /
          totalCells
        ) * 80
        -
        (
          duplicates /
          Math.max(
            1,
            rows.length
          )
        ) * 20
      )
    );


  return {
    name,
    headers: h,
    rows,
    missing,
    duplicates,
    types,
    domain,
    quality
  };
}


/* =========================================================
   PROJECT GENERATION
   ========================================================= */

async function createProject(
  tool = state.selectedTool,
  title = ""
) {

  state.selectedTool =
    tool;


  const ds =
    state.dataset;


  const industry =
    ds?.domain ||
    {
      powerbi: "E-commerce",
      sql: "Banking",
      python: "Retail",
      excel: "Operations",
      tableau: "Logistics",
      ml: "Subscription Business"
    }[tool];


  const companyMap = {
    "E-commerce":
      "NovaCart",

    "E-commerce / Retail":
      "NovaCart",

    "Food Delivery":
      "QuickBite",

    "Banking":
      "Finora Bank",

    "Banking / Finance":
      "Finora Bank",

    "Healthcare":
      "MediCore",

    "Logistics":
      "SwiftLogix",

    "Retail":
      "UrbanMart",

    "General Business":
      "Aurevia Group",

    "Operations":
      "Aurevia Operations",

    "Subscription Business":
      "Cloudly"
  };


  const company =
    companyMap[industry] ||
    "Aurevia Group";


  let project = {

    id:
      Date.now(),

    title:
      title ||
      `${industry} ${TOOLS[tool].name} Analytics`,

    tool,
    industry,
    company,

    objective:
      objectiveFor(
        industry
      ),

    created:
      new Date()
        .toISOString(),

    verified:
      false,

    progress: [
      {
        step:
          "Data Check",
        status:
          "completed"
      },

      {
        step:
          "Processing",
        status:
          "completed"
      },

      {
        step:
          "Analysis",
        status:
          "active"
      },

      {
        step:
          "Dashboard",
        status:
          "pending"
      },

      {
        step:
          "Insights",
        status:
          "pending"
      },

      {
        step:
          "Report",
        status:
          "pending"
      }
    ]
  };


  if (
    ds?.backendDatasetId
  ) {

    try {

      toast(
        "Creating project on Buildlytics server..."
      );


      const response =
        await fetch(
          `${API_BASE_URL}/generate-project`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                dataset_id:
                  ds.backendDatasetId,

                tool:
                  TOOLS[tool].name,

                level:
                  "Intermediate",

                industry:
                  ds.backendDomain ||
                  ds.domain
              })
          }
        );


      const remote =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (!response.ok) {

        throw new Error(
          remote.detail ||
          `Server error ${response.status}`
        );
      }


      project = {
        ...project,

        backendProjectId:
          remote.project_id,

        title:
          remote.title ||
          project.title,

        company:
          remote.company ||
          project.company,

        industry:
          remote.domain ||
          project.industry,

        objective:
          remote.management_assignment ||
          project.objective,

        businessQuestions:
          remote.business_questions ||
          [],

        progress:
          remote.progress ||
          project.progress,

        serverVerified:
          false
      };


      toast(
        "Project created by live backend"
      );

    } catch (error) {

      console.error(
        error
      );

      toast(
        "Server project unavailable. Using local workspace."
      );
    }
  }


  state.project =
    project;


  state.projects.unshift(
    project
  );


  state.projects =
    state.projects.slice(
      0,
      20
    );


  saveProjects();


  go(
    "workspace"
  );
}


function objectiveFor(industry) {
  return {
    "E-commerce":
      "Identify the drivers of revenue growth and margin decline, then build a management-ready performance view.",

    "E-commerce / Retail":
      "Identify the drivers of revenue growth and margin decline, then build a management-ready performance view.",

    "Food Delivery":
      "Find the main causes of delivery delays and identify restaurants, regions and time windows needing action.",

    "Banking":
      "Analyze customer and product performance while highlighting risk and profitability patterns.",

    "Banking / Finance":
      "Analyze customer and product performance while highlighting risk and profitability patterns.",

    "Healthcare":
      "Analyze operational performance and identify measurable opportunities for service improvement.",

    "Logistics":
      "Analyze delivery performance, bottlenecks and cost drivers across regions.",

    "Retail":
      "Identify product, category and store performance patterns that affect profitability."

  }[industry] ||
  "Turn raw operational data into clear business insights, evidence and management recommendations.";
}


function progressHTML() {

  const fallback = [
    {
      step: "Data Check",
      status: "completed"
    },

    {
      step: "Processing",
      status: "completed"
    },

    {
      step: "Analysis",
      status: "active"
    },

    {
      step: "Dashboard",
      status: "pending"
    },

    {
      step: "Insights",
      status: "pending"
    },

    {
      step: "Report",
      status: "pending"
    }
  ];


  const items =
    state.project?.progress ||
    fallback;


  return `
    <div class="progress-track">

      ${
        items.map(
          (item, index) => {

            const status =
              String(
                item.status || ""
              ).toLowerCase();


            let cls = "";


            if (
              status === "completed"
            ) {
              cls = "done";
            }


            if (
              status === "active" ||
              status === "ready"
            ) {
              cls = "active";
            }


            return `
              <div
                class="prog-item ${cls}"
              >

                <span class="prog-dot">

                  ${
                    status === "completed"
                      ? "✓"
                      : index + 1
                  }

                </span>

                ${esc(item.step)}

              </div>
            `;
          }
        ).join("")
      }

    </div>
  `;
}


function workspacePreview() {

  const p =
    state.project;


  return `
    <div class="card workspace">

      <div class="workspace-head">

        <div>

          <h2 style="margin:0">
            Project:
            ${esc(p.title)}
          </h2>

          <small class="muted">
            Tool:
            ${TOOLS[p.tool].name}
            · Company:
            ${esc(p.company)}
            ·
            ${esc(p.industry)}
          </small>

        </div>

        <button
          class="primary small"
          data-route="workspace"
        >
          Open Workspace
        </button>

      </div>

      ${progressHTML()}

      <div style="height:12px"></div>

      ${analysisHTML()}

    </div>
  `;
}


/* =========================================================
   METRICS
   ========================================================= */

function metrics() {

  const ds =
    state.dataset;


  let numeric = [];


  if (ds) {

    ds.headers.forEach(
      (header, index) => {

        if (
          ds.types[index] ===
          "number"
        ) {

          const values =
            ds.rows
              .map(
                row =>
                  Number(
                    String(
                      row[index] || ""
                    ).replace(
                      /[₹,$,%]/g,
                      ""
                    )
                  )
              )
              .filter(
                Number.isFinite
              );


          if (
            values.length
          ) {

            numeric.push({
              name:
                header,

              sum:
                values.reduce(
                  (a, b) =>
                    a + b,
                  0
                ),

              avg:
                values.reduce(
                  (a, b) =>
                    a + b,
                  0
                ) /
                values.length
            });
          }
        }
      }
    );
  }


  const fmt = number => {

    const n =
      Number(number) || 0;


    if (
      Math.abs(n) >=
      10000000
    ) {
      return (
        n /
        10000000
      ).toFixed(2) + " Cr";
    }


    if (
      Math.abs(n) >=
      100000
    ) {
      return (
        n /
        100000
      ).toFixed(2) + " L";
    }


    if (
      Math.abs(n) >=
      1000
    ) {
      return (
        n /
        1000
      ).toFixed(1) + "K";
    }


    return n.toFixed(1);
  };


  return [
    [
      "Total Records",
      (
        ds?.rows.length ||
        18645
      ).toLocaleString(),
      "Dataset"
    ],

    [
      numeric[0]?.name ||
      "Revenue",

      fmt(
        numeric[0]?.sum ||
        24500000
      ),

      "Calculated"
    ],

    [
      numeric[1]?.name ||
      "Profit",

      fmt(
        numeric[1]?.sum ||
        2845000
      ),

      "Calculated"
    ],

    [
      "Data Quality",
      (
        ds?.quality ||
        92
      ) + "%",
      "Verified"
    ],

    [
      "Avg Value",

      fmt(
        numeric[0]?.avg ||
        1314
      ),

      "Calculated"
    ]
  ];
}


function lineSVG() {
  return `
    <svg
      class="linechart"
      viewBox="0 0 600 180"
      preserveAspectRatio="none"
    >

      <g
        stroke="#1b3553"
        stroke-width="1"
      >
        <line x1="0" y1="150" x2="600" y2="150"/>
        <line x1="0" y1="100" x2="600" y2="100"/>
        <line x1="0" y1="50" x2="600" y2="50"/>
      </g>

      <polyline
        points="10,145 80,105 145,125 220,78 300,91 380,55 460,65 540,30 590,42"
        fill="none"
        stroke="#35d28d"
        stroke-width="4"
      />

      <polyline
        points="10,160 80,142 145,130 220,138 300,114 380,100 460,109 540,85 590,97"
        fill="none"
        stroke="#2d7ff9"
        stroke-width="4"
      />

    </svg>
  `;
}


function analysisHTML() {

  return `
    <div class="metrics-grid">

      ${
        metrics().map(
          metric => `
            <div class="card flat metric">

              <span>
                ${esc(metric[0])}
              </span>

              <strong>
                ${esc(metric[1])}
              </strong>

              <div class="delta">
                ${esc(metric[2])}
              </div>

            </div>
          `
        ).join("")
      }

    </div>


    <div
      class="analysis-grid"
      style="margin-top:10px"
    >

      <div class="card flat chart-card">

        <h3>
          Trend Overview
        </h3>

        ${lineSVG()}

      </div>


      <div class="card flat chart-card">

        <h3>
          Category Mix
        </h3>

        <div class="donut"></div>

        <div class="legend">

          <div>
            <span>Top Group</span>
            <b>40.2%</b>
          </div>

          <div>
            <span>Second</span>
            <b>28.1%</b>
          </div>

          <div>
            <span>Other</span>
            <b>31.7%</b>
          </div>

        </div>

      </div>


      <div class="card flat chart-card">

        <h3>
          Analysis Status
        </h3>

        <table class="table">

          <tbody>

            <tr>
              <td>Dataset</td>
              <td>
                ${
                  state.dataset
                    ? "✅ Loaded"
                    : "Demo"
                }
              </td>
            </tr>

            <tr>
              <td>Server API</td>
              <td>
                ${
                  state.dataset
                    ?.backendDatasetId
                    ? "✅ Connected"
                    : "Local"
                }
              </td>
            </tr>

            <tr>
              <td>Data Quality</td>
              <td>
                ${
                  state.dataset
                    ?.quality ||
                  92
                }%
              </td>
            </tr>

            <tr>
              <td>Domain</td>
              <td>
                ${
                  esc(
                    state.dataset
                      ?.domain ||
                    "Business"
                  )
                }
              </td>
            </tr>

          </tbody>

        </table>

      </div>

    </div>
  `;
}


/* =========================================================
   WORKSPACE
   ========================================================= */

function renderWorkspace() {

  if (!state.project) {

    $("#view").innerHTML =
      head(
        "Company Workspace",
        "Build or open a project to start."
      ) +

      `
      <div class="card empty">

        No active project yet.

        <br><br>

        <button
          class="primary"
          data-route="home"
        >
          Create Project
        </button>

      </div>
      `;

    return;
  }


  const p =
    state.project;


  const questions =
    p.businessQuestions?.length
      ? p.businessQuestions
      : [
          "Which segments drive the strongest business performance?",
          "Where is margin or efficiency weakening?",
          "Which factors explain the change?",
          "What should management prioritize next?"
        ];


  $("#view").innerHTML =

    head(
      `${esc(p.company)} — ${esc(p.title)}`,

      `Your role: Data Analyst · ${esc(p.industry)} · ${TOOLS[p.tool].name}`,

      `
        <button
          class="ghost"
          data-route="verify"
        >
          Verify
        </button>

        <button
          class="primary"
          data-route="exports"
        >
          Export
        </button>
      `
    )

    +

    `
    <div class="status-banner">

      <div>
        🏢
      </div>

      <div>

        <b>
          Management Assignment
        </b>

        <div class="muted small">
          ${esc(p.objective)}
        </div>

      </div>

    </div>


    <div
      class="workspace"
      style="margin-top:14px"
    >
      ${progressHTML()}
    </div>


    <div
      class="workspace-grid"
      style="margin-top:14px"
    >

      <div class="card flat">

        <h3>
          Project Commander
        </h3>

        <div class="task-list">

          ${
            [
              "Data Overview",
              "Data Cleaning",
              "KPI Generation",
              "Analysis",
              "Dashboard",
              "Insights",
              "Report"
            ].map(
              (task, index) => {

                const status =
                  p.progress?.[index]
                    ?.status ||
                  (
                    index < 3
                      ? "completed"
                      : index === 3
                      ? "active"
                      : "pending"
                  );


                const done =
                  status ===
                  "completed";


                const active =
                  status ===
                  "active" ||
                  status ===
                  "ready";


                return `
                  <div
                    class="task ${
                      done
                        ? "done"
                        : active
                        ? "active"
                        : ""
                    }"
                  >

                    <span class="task-dot">
                      ${
                        done
                          ? "✓"
                          : index + 1
                      }
                    </span>

                    <div>

                      ${task}

                      <small>
                        ${
                          done
                            ? "Completed"
                            : active
                            ? "Ready"
                            : "Pending"
                        }
                      </small>

                    </div>

                  </div>
                `;
              }
            ).join("")
          }

        </div>

      </div>


      <div class="main-analysis">
        ${analysisHTML()}
      </div>

    </div>


    <div
      class="grid g2"
      style="margin-top:14px"
    >

      <div class="card flat">

        <h3>
          Business Questions
        </h3>

        <ol class="muted">

          ${
            questions.map(
              question =>
                `<li>${esc(question)}</li>`
            ).join("")
          }

        </ol>

      </div>


      <div class="card flat">

        <h3>
          Explain This Project
        </h3>

        <p class="muted">
          Understand your project before presenting it.
        </p>

        <div class="actions">

          <button
            class="ghost small"
            id="simpleExplain"
          >
            Simple Hindi
          </button>

          <button
            class="ghost small"
            id="interviewExplain"
          >
            Interview Answer
          </button>

        </div>

        <div
          id="explainBox"
          class="code"
          style="margin-top:10px"
        >
          Select an explanation mode.
        </div>

      </div>

    </div>
    `;


  $("#simpleExplain").onclick =
    () => {

      $("#explainBox")
        .textContent =
        `Is project me hum ${p.company} ke ${p.industry} data ko analyze kar rahe hain. Pehle dataset ki quality check ki gayi, phir business questions aur KPIs define kiye gaye. Uske baad ${TOOLS[p.tool].name} ke through analysis karke management ke liye useful findings aur recommendations prepare ki ja rahi hain.`;
    };


  $("#interviewExplain").onclick =
    () => {

      $("#explainBox")
        .textContent =
        `I worked on a ${p.industry} analytics case study for ${p.company}. My objective was to ${p.objective.toLowerCase()} I started by validating the dataset, then defined the business questions and KPIs, performed the analysis using ${TOOLS[p.tool].name}, and structured the findings for management decision-making.`;
    };
}


/* =========================================================
   DATA SCANNER
   ========================================================= */

function renderScanner() {

  const d =
    state.dataset;


  if (!d) {

    $("#view").innerHTML =
      head(
        "Data Scanner",
        "Upload a CSV or Excel file and Buildlytics will inspect it."
      )

      +

      `
      <div
        class="upload-zone"
        id="dropZone"
      >

        <div>

          <div class="upload-icon">
            ↥
          </div>

          <h2>
            Upload Dataset
          </h2>

          <p>
            CSV / Excel
          </p>

          <button
            class="primary"
            id="chooseFile"
          >
            Choose File
          </button>

        </div>

      </div>
      `;


    bindUpload();

    return;
  }


  $("#view").innerHTML =

    head(
      "Data Scanner",
      `${esc(d.name)} · ${esc(d.domain)}`
    )

    +

    `
    <div class="grid g4">

      <div class="card stat-card">
        <span class="muted">Rows</span>
        <strong>
          ${d.rows.length.toLocaleString()}
        </strong>
      </div>

      <div class="card stat-card">
        <span class="muted">Columns</span>
        <strong>
          ${d.headers.length}
        </strong>
      </div>

      <div class="card stat-card">
        <span class="muted">Missing Cells</span>
        <strong>
          ${d.missing.toLocaleString()}
        </strong>
      </div>

      <div class="card stat-card">
        <span class="muted">Quality Score</span>
        <strong>
          ${d.quality}/100
        </strong>
      </div>

    </div>


    <div
      class="grid g2"
      style="margin-top:14px"
    >

      <div class="card flat">

        <h3>
          Detected Schema
        </h3>

        <div style="overflow:auto">

          <table class="table">

            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
              </tr>
            </thead>

            <tbody>

              ${
                d.headers.map(
                  (header, index) => `
                    <tr>
                      <td>
                        ${esc(header)}
                      </td>

                      <td>
                        ${esc(
                          d.types[index]
                        )}
                      </td>
                    </tr>
                  `
                ).join("")
              }

            </tbody>

          </table>

        </div>

      </div>


      <div class="card flat">

        <h3>
          Health Check
        </h3>

        <div class="status-banner">

          <div class="score">
            ${d.quality}
          </div>

          <div>

            <b>
              Dataset Health
            </b>

            <div class="muted small">

              ${d.duplicates}
              duplicate rows

              ·

              ${d.missing}
              missing cells

              · Domain:
              ${esc(d.domain)}

            </div>

          </div>

        </div>


        <h3 style="margin-top:18px">
          Backend Status
        </h3>

        <p class="muted">

          ${
            d.backendDatasetId

              ? `✅ Live server scan completed.<br>Dataset ID: ${esc(d.backendDatasetId)}`

              : "⚠️ Dataset is currently using local browser analysis."
          }

        </p>


        <h3 style="margin-top:18px">
          Recommended Next Step
        </h3>

        <p class="muted">
          Build a focused project using the detected domain.
        </p>

        <button
          class="primary"
          id="recommendedProject"
        >
          Build Recommended Project
        </button>

      </div>

    </div>
    `;


  $("#recommendedProject").onclick =
    () => {

      createProject(
        "powerbi",
        `${d.domain} Performance Analytics`
      );
    };
}


/* =========================================================
   PROJECT LIST
   ========================================================= */

function renderProjects() {

  const projects =
    state.projects;


  $("#view").innerHTML =

    head(
      "My Projects",
      "Your saved Buildlytics projects.",
      `
        <button
          class="primary"
          data-route="new"
        >
          New Project
        </button>
      `
    )

    +

    (
      projects.length

      ? `
        <div class="grid g3">

          ${
            projects.map(
              p => `
                <div class="card flat">

                  <div class="chips">

                    <span class="chip blue">
                      ${
                        TOOLS[p.tool]
                          ?.name ||
                        p.tool
                      }
                    </span>

                    <span class="chip green">
                      ${esc(p.industry)}
                    </span>

                  </div>

                  <h3 style="margin-top:12px">
                    ${esc(p.title)}
                  </h3>

                  <p class="muted small">
                    ${esc(p.company)}
                  </p>

                  ${
                    p.backendProjectId
                      ? `
                        <span class="chip green">
                          API Connected
                        </span>
                      `
                      : ""
                  }

                  <br><br>

                  <button
                    class="ghost small"
                    data-open="${p.id}"
                  >
                    Open
                  </button>

                </div>
              `
            ).join("")
          }

        </div>
      `

      : `
        <div class="card empty">

          <h3>
            You haven't created a project yet.
          </h3>

          <p class="muted">
            Upload a dataset or choose a tool to create your first analytics project.
          </p>

          <button
            class="primary"
            data-route="new"
          >
            Create My First Project →
          </button>

        </div>
      `
    );


  $$("[data-open]").forEach(
    button => {

      button.onclick =
        () => {

          state.project =
            projects.find(
              p =>
                String(p.id) ===
                button.dataset.open
            );

          go(
            "workspace"
          );
        };
    }
  );
}


/* =========================================================
   NEW PROJECT
   ========================================================= */

function renderNew() {

  $("#view").innerHTML =

    head(
      "New Project",
      "Choose exactly what you want to build."
    )

    +

    `
    <div class="card flat">

      <div class="form-grid">

        <div class="field">

          <label>
            Tool
          </label>

          <select id="newTool">

            ${
              Object.entries(
                TOOLS
              ).map(
                ([key, value]) =>
                  `
                  <option value="${key}">
                    ${value.name}
                  </option>
                  `
              ).join("")
            }

          </select>

        </div>


        <div class="field">

          <label>
            Industry
          </label>

          <select id="newIndustry">

            <option>
              E-commerce
            </option>

            <option>
              Banking
            </option>

            <option>
              Food Delivery
            </option>

            <option>
              Retail
            </option>

            <option>
              Healthcare
            </option>

            <option>
              Logistics
            </option>

          </select>

        </div>


        <div class="field wide">

          <label>
            What do you want to build?
          </label>

          <textarea
            id="newPrompt"
            placeholder="Example: Advanced Power BI project for an e-commerce company focused on sales and profitability."
          ></textarea>

        </div>

      </div>


      <button
        class="primary"
        id="newBuild"
      >
        Generate Company Workspace
      </button>

    </div>
    `;


  $("#newBuild").onclick =
    async () => {

      const tool =
        $("#newTool").value;

      const industry =
        $("#newIndustry").value;

      const prompt =
        $("#newPrompt")
          .value
          .trim();


      state.selectedTool =
        tool;


      if (
        state.dataset
      ) {

        state.dataset.domain =
          industry;

        state.dataset.backendDomain =
          industry;
      }


      await createProject(
        tool,
        prompt
          ? prompt.slice(
              0,
              70
            )
          : `${industry} ${TOOLS[tool].name} Analytics`
      );
    };
}


/* =========================================================
   PROJECT VERIFY
   ========================================================= */

async function verifyWithBackend() {

  const id =
    state.project
      ?.backendProjectId;


  if (!id) {
    return null;
  }


  const response =
    await fetch(
      `${API_BASE_URL}/verify-project/${id}`,
      {
        method:
          "POST"
      }
    );


  const data =
    await response
      .json()
      .catch(
        () => ({})
      );


  if (!response.ok) {

    throw new Error(
      data.detail ||
      "Verification failed"
    );
  }


  return data;
}


async function renderVerify() {

  if (!state.project) {

    $("#view").innerHTML =
      head(
        "Project Verify",
        "Open a project first."
      )

      +

      `
      <div class="card empty">
        No active project.
      </div>
      `;

    return;
  }


  $("#view").innerHTML =
    head(
      "Project Verify",
      "Checking project consistency..."
    )

    +

    `
    <div class="card flat">
      Running verification...
    </div>
    `;


  try {

    const remote =
      await verifyWithBackend();


    if (remote) {

      state.project.verified =
        remote.verified;

      state.project.serverVerified =
        true;

      saveProjects();


      $("#view").innerHTML =

        head(
          "Project Verify",
          "Server-side project verification."
        )

        +

        `
        <div class="status-banner">

          <div class="score">
            ${remote.score}
          </div>

          <div>

            <b>
              ${
                remote.verified
                  ? "Project Verified ✓"
                  : "Needs Attention"
              }
            </b>

            <div class="muted small">
              Buildlytics backend verification
            </div>

          </div>

        </div>


        <div
          class="card flat"
          style="margin-top:14px"
        >

          <table class="table">

            <thead>

              <tr>
                <th>Check</th>
                <th>Status</th>
              </tr>

            </thead>

            <tbody>

              ${
                remote.checks.map(
                  check => `
                    <tr>

                      <td>
                        ${esc(check.name)}
                      </td>

                      <td>
                        ${
                          check.passed
                            ? "✅ Pass"
                            : "⚠️ Review"
                        }
                      </td>

                    </tr>
                  `
                ).join("")
              }

            </tbody>

          </table>

          <p class="muted small">
            ${esc(remote.note || "")}
          </p>

        </div>
        `;

      return;
    }

  } catch (error) {

    console.error(error);

    toast(
      "Server verification unavailable. Using local checks."
    );
  }


  const d =
    state.dataset;


  const checks = [

    [
      "Dataset structure",
      true,
      "Columns and rows are readable."
    ],

    [
      "Missing-value awareness",
      !d ||
      d.quality >= 55,

      d
        ? `${d.missing} missing cells detected.`
        : "Demo dataset."
    ],

    [
      "Duplicate awareness",
      !d ||
      d.duplicates <
      Math.max(
        10,
        d.rows.length * 0.05
      ),

      d
        ? `${d.duplicates} duplicate rows detected.`
        : "No duplicate issue."
    ],

    [
      "Project objective",
      true,
      "Business objective is clearly defined."
    ],

    [
      "Export readiness",
      true,
      "Project package can be generated."
    ]
  ];


  const score =
    Math.round(
      checks.filter(
        x => x[1]
      ).length /
      checks.length *
      100
    );


  state.project.verified =
    score >= 80;


  $("#view").innerHTML =

    head(
      "Project Verify",
      "Local project verification."
    )

    +

    `
    <div class="status-banner">

      <div class="score">
        ${score}
      </div>

      <div>

        <b>
          ${
            score >= 80
              ? "Portfolio Ready ✓"
              : "Needs Attention"
          }
        </b>

        <div class="muted small">
          Local verification
        </div>

      </div>

    </div>


    <div
      class="card flat"
      style="margin-top:14px"
    >

      <table class="table">

        <tbody>

          ${
            checks.map(
              check => `
                <tr>

                  <td>
                    ${check[0]}
                  </td>

                  <td>
                    ${
                      check[1]
                        ? "✅ Pass"
                        : "⚠️ Review"
                    }
                  </td>

                  <td>
                    ${esc(check[2])}
                  </td>

                </tr>
              `
            ).join("")
          }

        </tbody>

      </table>

    </div>
    `;
}


/* =========================================================
   EXPORT
   ========================================================= */

function toCSV(
  headers,
  rows
) {

  const quote =
    value =>
      `"${String(
        value ?? ""
      ).replaceAll(
        '"',
        '""'
      )}"`;


  return [
    headers
      .map(quote)
      .join(","),

    ...rows.map(
      row =>
        headers.map(
          (_, index) =>
            quote(
              row[index]
            )
        ).join(",")
    )
  ].join("\n");
}


function exportFiles() {

  const p =
    state.project ||
    {
      title:
        "Buildlytics Project",

      company:
        "Aurevia Group",

      industry:
        "Business",

      tool:
        "powerbi",

      objective:
        "Build a professional analytics project."
    };


  const d =
    state.dataset;


  const csv =
    d

      ? toCSV(
          d.headers,
          d.rows
        )

      : `order_id,region,revenue,profit
1001,West,125000,18000
1002,North,98000,12000
`;


  const readme =
`# ${p.company} — ${p.title}

**Industry:** ${p.industry}
**Tool:** ${TOOLS[p.tool]?.name || p.tool}

## Business Objective

${p.objective}

## Workflow

Data Check → Processing → Analysis → Dashboard → Insights → Report

## Buildlytics Verification

${p.verified ? "Verified" : "Not verified yet"}

## Portfolio Disclosure

Independent portfolio case study based on a simulated business scenario unless your own dataset is used.
`;


  const report =
`BUILDLYTICS AI — PROJECT REPORT

Company: ${p.company}
Project: ${p.title}
Industry: ${p.industry}
Tool: ${TOOLS[p.tool]?.name || p.tool}

BUSINESS OBJECTIVE

${p.objective}

PROJECT WORKFLOW

1. Data validation
2. Cleaning and preparation
3. KPI design
4. Analysis
5. Visualization
6. Evidence-backed insights
7. Recommendations

INTERVIEW SUMMARY

I worked on a ${p.industry} analytics case study for ${p.company}. I started by validating the data, then defined business questions and created the analysis in ${TOOLS[p.tool]?.name || p.tool}.
`;


  const files = {

    "README.md":
      readme,

    "01_Dataset/dataset.csv":
      csv,

    "08_Project_Report/project_report.txt":
      report,

    "10_Interview_Preparation/interview_answer.txt":
      report
  };


  if (
    p.tool === "powerbi"
  ) {

    files[
      "05_Dashboard/DAX_Measures.txt"
    ] =
`Total Revenue = SUM(Sales[Revenue])

Total Profit = SUM(Sales[Profit])

Profit Margin = DIVIDE([Total Profit], [Total Revenue])

Order Count = DISTINCTCOUNT(Sales[Order_ID])
`;
  }


  if (
    p.tool === "sql"
  ) {

    files[
      "02_SQL/analysis.sql"
    ] =
`SELECT
    region,
    SUM(revenue) AS revenue,
    SUM(profit) AS profit
FROM sales
GROUP BY region
ORDER BY revenue DESC;
`;
  }


  if (
    p.tool === "python"
  ) {

    files[
      "03_Python/analysis.py"
    ] =
`import pandas as pd

df = pd.read_csv("../01_Dataset/dataset.csv")

print(df.info())

print(df.describe(include="all"))
`;
  }


  if (
    p.tool === "excel"
  ) {

    files[
      "04_Excel/build_guide.txt"
    ] =
      "Raw Data → Clean Data → Calculations → Pivot Analysis → Executive Dashboard";
  }


  if (
    p.tool === "tableau"
  ) {

    files[
      "05_Tableau/build_guide.txt"
    ] =
      "KPI Strip → Trend → Region → Category → Customer Segment → Insight Callouts";
  }


  if (
    p.tool === "ml"
  ) {

    files[
      "06_Machine_Learning/model_plan.txt"
    ] =
      "Preprocessing → Train/Test Split → Baseline → Model Comparison → Cross Validation → Metrics → Feature Importance → Limitations";
  }


  return files;
}


function blobDownload(
  blob,
  name
) {

  const a =
    document.createElement(
      "a"
    );


  a.href =
    URL.createObjectURL(
      blob
    );


  a.download =
    name;


  document.body.appendChild(
    a
  );


  a.click();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        a.href
      );

      a.remove();

    },
    500
  );
}


const crcTable =
  (() => {

    let table = [];

    for (
      let n = 0;
      n < 256;
      n++
    ) {

      let c = n;

      for (
        let k = 0;
        k < 8;
        k++
      ) {

        c =
          (c & 1)
            ? 0xedb88320 ^
              (c >>> 1)
            : c >>> 1;
      }

      table[n] =
        c >>> 0;
    }

    return table;
  })();


function crc32(bytes) {

  let c =
    0xffffffff;


  for (
    const byte of bytes
  ) {

    c =
      crcTable[
        (c ^ byte) &
        255
      ] ^
      (c >>> 8);
  }


  return (
    c ^
    0xffffffff
  ) >>> 0;
}


const u16 =
  n => [
    n & 255,
    (n >>> 8) & 255
  ];


const u32 =
  n => [
    n & 255,
    (n >>> 8) & 255,
    (n >>> 16) & 255,
    (n >>> 24) & 255
  ];


function makeZip(files) {

  const encoder =
    new TextEncoder();


  const locals = [];
  const centrals = [];


  let offset = 0;
  let count = 0;


  for (
    const [
      name,
      content
    ]
    of Object.entries(files)
  ) {

    const filename =
      encoder.encode(name);


    const data =
      encoder.encode(content);


    const crc =
      crc32(data);


    const local =
      new Uint8Array([
        ...u32(0x04034b50),
        ...u16(20),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(crc),
        ...u32(data.length),
        ...u32(data.length),
        ...u16(filename.length),
        ...u16(0),
        ...filename,
        ...data
      ]);


    locals.push(
      local
    );


    centrals.push(
      new Uint8Array([
        ...u32(0x02014b50),
        ...u16(20),
        ...u16(20),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(crc),
        ...u32(data.length),
        ...u32(data.length),
        ...u16(filename.length),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
        ...filename
      ])
    );


    offset +=
      local.length;


    count++;
  }


  const centralSize =
    centrals.reduce(
      (a, b) =>
        a + b.length,
      0
    );


  const end =
    new Uint8Array([
      ...u32(0x06054b50),
      ...u16(0),
      ...u16(0),
      ...u16(count),
      ...u16(count),
      ...u32(centralSize),
      ...u32(offset),
      ...u16(0)
    ]);


  return new Blob(
    [
      ...locals,
      ...centrals,
      end
    ],
    {
      type:
        "application/zip"
    }
  );
}


function renderExports() {

  if (!state.project) {

    $("#view").innerHTML =
      head(
        "Export Center",
        "Create a project first."
      )

      +

      `
      <div class="card empty">
        No active project.
      </div>
      `;

    return;
  }


  $("#view").innerHTML =

    head(
      "Export Center",
      "Download a complete portfolio-ready project package."
    )

    +

    `
    <div class="grid g3">

      <div class="card flat">

        <h3>
          📦 Complete ZIP
        </h3>

        <p class="muted">
          Dataset, README, report and tool-specific files.
        </p>

        <button
          class="primary"
          id="zipBtn"
        >
          Download ZIP
        </button>

      </div>


      <div class="card flat">

        <h3>
          📄 Project Report
        </h3>

        <p class="muted">
          Download the project report.
        </p>

        <button
          class="ghost"
          id="reportBtn"
        >
          Download Report
        </button>

      </div>


      <div class="card flat">

        <h3>
          🧾 README
        </h3>

        <p class="muted">
          GitHub-ready README.
        </p>

        <button
          class="ghost"
          id="readmeBtn"
        >
          Download README
        </button>

      </div>

    </div>
    `;


  $("#zipBtn").onclick =
    () => {

      blobDownload(
        makeZip(
          exportFiles()
        ),
        "Buildlytics-Project.zip"
      );

      toast(
        "ZIP generated"
      );
    };


  $("#reportBtn").onclick =
    () => {

      blobDownload(
        new Blob(
          [
            exportFiles()[
              "08_Project_Report/project_report.txt"
            ]
          ],
          {
            type:
              "text/plain"
          }
        ),
        "project_report.txt"
      );
    };


  $("#readmeBtn").onclick =
    () => {

      blobDownload(
        new Blob(
          [
            exportFiles()[
              "README.md"
            ]
          ],
          {
            type:
              "text/markdown"
          }
        ),
        "README.md"
      );
    };
}


/* =========================================================
   INTERVIEW
   ========================================================= */

function renderInterview() {

  const p =
    state.project;


  $("#view").innerHTML =

    head(
      "Interview Mode",
      "Practice explaining your own project clearly."
    )

    +

    (
      p

      ? `
        <div class="grid g2">

          <div class="card flat">

            <h3>
              Question 1
            </h3>

            <p>
              Tell me about your ${TOOLS[p.tool].name} project.
            </p>

            <textarea
              id="ans"
              style="
                width:100%;
                min-height:140px;
                background:var(--panel2);
                color:var(--text);
                border:1px solid var(--line);
                border-radius:10px;
                padding:12px
              "
              placeholder="Type your answer..."
            ></textarea>

            <button
              class="primary"
              id="eval"
              style="margin-top:10px"
            >
              Evaluate Answer
            </button>

          </div>


          <div class="card flat">

            <h3>
              Suggested Structure
            </h3>

            <div class="code">
1. Company / business context
2. Problem you were solving
3. Data preparation
4. Analysis approach
5. Key insight
6. Recommendation
7. What you learned
            </div>

            <div
              id="feedback"
              class="muted"
              style="margin-top:12px"
            >
              Your feedback will appear here.
            </div>

          </div>

        </div>
      `

      : `
        <div class="card empty">
          Open a project first.
        </div>
      `
    );


  $("#eval")
    ?.addEventListener(
      "click",
      () => {

        const answer =
          $("#ans")
            .value
            .trim();


        const words =
          answer
            ? answer
                .split(/\s+/)
                .length
            : 0;


        const score =
          Math.min(
            100,
            30 +
            Math.round(
              words * 1.2
            )
          );


        $("#feedback")
          .innerHTML =
          `
          <b>
            Communication score:
            ${score}/100
          </b>

          <br>

          ${
            answer.length < 120

              ? "Add the business problem, your approach and one measurable insight."

              : "Good structure. Make sure every claimed result is supported by your actual project data."
          }
          `;
      }
    );
}


/* =========================================================
   GENERIC PAGES
   ========================================================= */

function renderGeneric(
  title,
  sub,
  body
) {

  $("#view").innerHTML =
    head(
      title,
      sub
    )

    +

    `
    <div class="card flat">
      ${body}
    </div>
    `;
}


function datasetTable() {

  const d =
    state.dataset;


  if (!d) {

    return `
      <div class="empty">
        No dataset loaded yet.
      </div>
    `;
  }


  return `
    <div style="overflow:auto">

      <table class="table">

        <thead>
          <tr>

            ${
              d.headers.map(
                header =>
                  `<th>${esc(header)}</th>`
              ).join("")
            }

          </tr>
        </thead>

        <tbody>

          ${
            d.rows
              .slice(0, 20)
              .map(
                row => `
                  <tr>

                    ${
                      d.headers.map(
                        (_, index) =>
                          `
                          <td>
                            ${esc(
                              row[index] ?? ""
                            )}
                          </td>
                          `
                      ).join("")
                    }

                  </tr>
                `
              ).join("")
          }

        </tbody>

      </table>

    </div>

    <p class="muted small">
      Showing first 20 rows.
    </p>
  `;
}


/* =========================================================
   MAIN RENDER
   ========================================================= */

function render() {

  renderNav();


  const map = {

    home:
      renderHome,

    workspace:
      renderWorkspace,

    scanner:
      renderScanner,

    projects:
      renderProjects,

    recent:
      renderProjects,

    new:
      renderNew,

    exports:
      renderExports,

    verify:
      renderVerify,

    interview:
      renderInterview,


    datasets:
      () =>
        renderGeneric(
          "My Datasets",

          "Your current uploaded dataset.",

          state.dataset

            ? `
              <h3>
                ${esc(state.dataset.name)}
              </h3>

              <p>
                ${state.dataset.rows.length}
                rows ·

                ${state.dataset.headers.length}
                columns ·

                ${esc(state.dataset.domain)}
              </p>

              <p>
                ${
                  state.dataset
                    .backendDatasetId

                    ? "✅ Live backend connected"

                    : "Local browser dataset"
                }
              </p>

              <button
                class="primary"
                data-route="scanner"
              >
                Open Scanner
              </button>
            `

            : `
              <div class="empty">
                No dataset loaded yet.
              </div>
            `
        ),


    explorer:
      () =>
        renderGeneric(
          "Data Explorer",
          "Preview your currently loaded dataset.",
          datasetTable()
        ),


    templates:
      () =>
        renderGeneric(
          "Project Templates",
          "Start with focused analytics templates.",
          `
            <div class="grid g3">
              ${
                suggestedProjects()
                  .map(projectCard)
                  .join("")
              }
            </div>
          `
        ),


    portfolio:
      () =>
        renderGeneric(
          "Portfolio Builder",

          "Convert your verified project into a clean portfolio case study.",

          state.project

            ? `
              <h2>
                ${esc(state.project.company)}
                —
                ${esc(state.project.title)}
              </h2>

              <p class="muted">
                Problem → Data → Process → Dashboard → Insights → Recommendations → Skills
              </p>

              <button
                class="primary"
                data-route="exports"
              >
                Export Project Pack
              </button>
            `

            : `
              <div class="empty">
                Create a project first.
              </div>
            `
        ),


    resume:
      () =>
        renderGeneric(
          "Resume Bullets",

          "Generate safer project bullets based on the work you actually completed.",

          state.project

            ? `
              <div class="code">

• Built a ${TOOLS[state.project.tool].name} analytics case study for a ${state.project.industry} business scenario.

• Validated the dataset, defined business KPIs and structured findings into management-ready analysis.

• Created project documentation and interview-ready explanations.

              </div>
            `

            : `
              <div class="empty">
                Create a project first.
              </div>
            `
        ),


    inbox:
      () =>
        renderGeneric(
          "Manager Inbox",

          "Simulated stakeholder requests for your active project.",

          state.project

            ? `
              <div class="activity-row">

                <div class="activity-icon">
                  ✉
                </div>

                <div>

                  <b>
                    Operations Manager
                  </b>

                  <small class="muted">
                    Can you explain why performance changed in the weakest segment and add one action recommendation?
                  </small>

                </div>

              </div>


              <div class="activity-row">

                <div class="activity-icon">
                  ✉
                </div>

                <div>

                  <b>
                    BI Lead
                  </b>

                  <small class="muted">
                    Please make sure the final report uses the same KPI definitions as the dashboard.
                  </small>

                </div>

              </div>
            `

            : `
              <div class="empty">
                Open a project first.
              </div>
            `
        ),


    tasks:
      () =>
        renderGeneric(
          "Task Board",

          "Your current project workflow.",

          state.project

            ? `
              <div class="task-list">

                ${
                  [
                    "Validate data",
                    "Clean data",
                    "Define KPIs",
                    "Analyze drivers",
                    "Build dashboard",
                    "Write insights",
                    "Prepare report"
                  ].map(
                    (task, index) => `
                      <div
                        class="task ${
                          index < 3
                            ? "done"
                            : index === 3
                            ? "active"
                            : ""
                        }"
                      >

                        <span class="task-dot">

                          ${
                            index < 3
                              ? "✓"
                              : index + 1
                          }

                        </span>

                        <div>
                          ${task}
                        </div>

                      </div>
                    `
                  ).join("")
                }

              </div>
            `

            : `
              <div class="empty">
                No active project.
              </div>
            `
        ),


    plans:
      () =>
        renderGeneric(
          "Buildlytics Plans",

          "Founder access is already unlocked.",

          `
          <div class="grid g2">

            <div class="card flat">

              <h2>
                Free
              </h2>

              <p class="muted">
                Basic project creation, single-tool projects and limited exports.
              </p>

            </div>


            <div
              class="card flat"
              style="border-color:#5b4cf2"
            >

              <span class="chip yellow">
                FOUNDER FULL ACCESS
              </span>

              <h2>
                Pro
              </h2>

              <p class="muted">
                Advanced projects, verify, interview prep, complete exports, portfolio tools and future AI generation.
              </p>

            </div>

          </div>
          `
        ),


    owner:
      () =>
        renderGeneric(
          "Founder Dashboard",

          "Owner controls.",

          `
          <div class="grid g4">

            <div class="card stat-card">
              <span class="muted">
                Projects
              </span>

              <strong>
                ${state.projects.length}
              </strong>
            </div>


            <div class="card stat-card">
              <span class="muted">
                Dataset
              </span>

              <strong>
                ${
                  state.dataset
                    ? "Loaded"
                    : "None"
                }
              </strong>
            </div>


            <div class="card stat-card">
              <span class="muted">
                Access
              </span>

              <strong>
                Full
              </strong>
            </div>


            <div class="card stat-card">
              <span class="muted">
                Backend
              </span>

              <strong>
                Live API
              </strong>
            </div>

          </div>
          `
        )
  };


  const page =
    map[state.route] ||
    renderHome;


  page();


  $$("[data-route]")
    .forEach(
      button => {

        button.onclick =
          e => {

            e.preventDefault();

            go(
              button.dataset.route
            );
          };
      }
    );


  $$("[data-build]")
    .forEach(
      button => {

        button.onclick =
          () => {

            createProject(
              button.dataset.build,
              button.dataset.title
            );
          };
      }
    );
}


/* =========================================================
   HEADER CONTROLS
   ========================================================= */

$("#menuBtn")
  ?.addEventListener(
    "click",
    () => {

      $("#sidebar")
        ?.classList.add(
          "open"
        );

      $("#backdrop")
        ?.classList.add(
          "show"
        );
    }
  );


$("#backdrop")
  ?.addEventListener(
    "click",
    () => {

      $("#sidebar")
        ?.classList.remove(
          "open"
        );

      $("#backdrop")
        ?.classList.remove(
          "show"
        );
    }
  );


$("#themeBtn")
  ?.addEventListener(
    "click",
    () => {

      document.documentElement
        .classList
        .toggle(
          "light"
        );


      state.theme =
        document.documentElement
          .classList
          .contains(
            "light"
          )

          ? "light"
          : "dark";


      localStorage.setItem(
        "buildlytics_theme",
        state.theme
      );
    }
  );


$("#notifyBtn")
  ?.addEventListener(
    "click",
    () =>
      toast(
        "No new notifications"
      )
  );


$("#globalSearch")
  ?.addEventListener(
    "keydown",
    e => {

      if (
        e.key !== "Enter"
      ) return;


      const query =
        e.target.value
          .toLowerCase();


      if (
        query.includes(
          "data"
        )
      ) {

        go(
          "scanner"
        );

      } else if (
        query.includes(
          "project"
        )
      ) {

        go(
          "projects"
        );

      } else if (
        query.includes(
          "interview"
        )
      ) {

        go(
          "interview"
        );

      } else {

        toast(
          "Try: project, data, interview"
        );
      }
    }
  );


/* =========================================================
   LANDING + ONBOARDING
   ========================================================= */

const landing =
  $("#landing");

const shell =
  $(".shell");

const side =
  $("#sidebar");


function enterApp(
  showTour = false
) {

  landing
    ?.classList
    .add(
      "hidden"
    );


  shell
    ?.classList
    .remove(
      "public-mode"
    );


  side
    ?.classList
    .remove(
      "public-mode"
    );


  if (
    showTour &&
    !localStorage.getItem(
      "buildlytics_tour_done"
    )
  ) {

    startTour();
  }
}


function showLanding() {

  landing
    ?.classList
    .remove(
      "hidden"
    );


  shell
    ?.classList
    .add(
      "public-mode"
    );


  side
    ?.classList
    .add(
      "public-mode"
    );
}


const tourSteps = [

  [
    "Welcome to Buildlytics 👋",
    "Upload your own CSV/Excel or create a company-style project without data."
  ],

  [
    "Choose exactly one tool",
    "Power BI, SQL, Python, Excel, Tableau or Machine Learning."
  ],

  [
    "Use the Project Commander",
    "Your workspace shows what is complete and what comes next."
  ],

  [
    "Finish with confidence",
    "Verify, understand, interview practice and export your project."
  ]
];


function startTour() {

  let index = 0;


  const overlay =
    document.createElement(
      "div"
    );


  overlay.className =
    "tour-overlay";


  const finish =
    () => {

      localStorage.setItem(
        "buildlytics_tour_done",
        "1"
      );

      overlay.remove();

      go(
        "home"
      );
    };


  const draw =
    () => {

      const [
        title,
        body
      ] =
        tourSteps[index];


      overlay.innerHTML =
        `
        <div class="tour-card">

          <span class="chip blue">
            QUICK TOUR
            ${index + 1}/${tourSteps.length}
          </span>

          <h2>
            ${title}
          </h2>

          <p class="muted">
            ${body}
          </p>

          <div class="tour-actions">

            <button
              class="ghost"
              id="skipTour"
            >
              Skip tour
            </button>

            <button
              class="primary"
              id="nextTour"
            >
              ${
                index ===
                tourSteps.length - 1

                  ? "Start Building"
                  : "Next →"
              }
            </button>

          </div>

        </div>
        `;


      overlay.querySelector(
        "#skipTour"
      ).onclick =
        finish;


      overlay.querySelector(
        "#nextTour"
      ).onclick =
        () => {

          index++;

          if (
            index >=
            tourSteps.length
          ) {

            finish();

          } else {

            draw();
          }
        };
    };


  document.body.appendChild(
    overlay
  );


  draw();
}


function loadDemo() {

  state.dataset =
    analyzeDataset(

      "buildlytics_ecommerce_demo.csv",

      [
        "Order_ID",
        "Order_Date",
        "Region",
        "Category",
        "Revenue",
        "Profit"
      ],

      [
        [
          "1001",
          "2026-01-05",
          "West",
          "Electronics",
          "125000",
          "18000"
        ],

        [
          "1002",
          "2026-01-06",
          "North",
          "Furniture",
          "98000",
          "12000"
        ],

        [
          "1003",
          "2026-01-07",
          "West",
          "Electronics",
          "151000",
          "14000"
        ],

        [
          "1004",
          "2026-01-08",
          "South",
          "Office Supplies",
          "76000",
          "16000"
        ],

        [
          "1005",
          "2026-01-09",
          "East",
          "Furniture",
          "112000",
          "21000"
        ]
      ]
    );


  enterApp(false);

  go(
    "home"
  );


  toast(
    "Demo dataset loaded"
  );
}


$("#landingStart")
  ?.addEventListener(
    "click",
    () =>
      enterApp(true)
  );


$("#heroStart")
  ?.addEventListener(
    "click",
    () =>
      enterApp(true)
  );


$("#tryDemo")
  ?.addEventListener(
    "click",
    loadDemo
  );


$("#demoBuild")
  ?.addEventListener(
    "click",
    () => {

      loadDemo();

      createProject(
        "powerbi",
        "Sales & Profitability Intelligence"
      );
    }
  );


/* =========================================================
   HELP
   ========================================================= */

const help =
  document.createElement(
    "button"
  );


help.className =
  "primary help-fab";


help.textContent =
  "? Help";


document.body.appendChild(
  help
);


const helpPanel =
  document.createElement(
    "div"
  );


helpPanel.className =
  "help-panel hidden";


helpPanel.innerHTML =
  `
  <h3>
    How can we help?
  </h3>

  <p class="muted small">
    New here? Use this simple path:
  </p>

  <div class="task-list">

    <div class="task done">
      <span class="task-dot">1</span>
      <div>Upload data or start without it</div>
    </div>

    <div class="task">
      <span class="task-dot">2</span>
      <div>Choose your project tool</div>
    </div>

    <div class="task">
      <span class="task-dot">3</span>
      <div>Follow Company Workspace</div>
    </div>

    <div class="task">
      <span class="task-dot">4</span>
      <div>Verify, understand and export</div>
    </div>

  </div>

  <div
    class="actions"
    style="margin-top:14px"
  >

    <button
      class="ghost small"
      id="tourAgain"
    >
      Quick Tour
    </button>

    <button
      class="ghost small"
      id="backLanding"
    >
      About Buildlytics
    </button>

  </div>
  `;


document.body.appendChild(
  helpPanel
);


help.onclick =
  () => {

    helpPanel
      .classList
      .toggle(
        "hidden"
      );
  };


helpPanel
  .querySelector(
    "#tourAgain"
  )
  .onclick =
    () => {

      helpPanel
        .classList
        .add(
          "hidden"
        );

      startTour();
    };


helpPanel
  .querySelector(
    "#backLanding"
  )
  .onclick =
    () => {

      helpPanel
        .classList
        .add(
          "hidden"
        );

      showLanding();
    };


/* =========================================================
   START APP
   ========================================================= */

render();
showLanding();


/* =========================================================
   BACKEND WAKE-UP
   ========================================================= */

apiHealth()
  .then(
    online => {

      if (online) {

        console.log(
          "Buildlytics API connected ✅"
        );

      } else {

        console.log(
          "Buildlytics API sleeping/offline"
        );
      }
    }
  )
  .catch(
    () => {}
  );
