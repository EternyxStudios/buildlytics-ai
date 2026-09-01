function currentAnalytics() {

  return (
    state.project?.analytics ||
    state.dataset?.backendAnalytics ||
    null
  );
}


function formatAnalyticsNumber(value, name = "") {

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return String(value ?? "0");
  }

  const lower = String(name).toLowerCase();

  if (
    lower.includes("percentage") ||
    lower.includes("percent")
  ) {
    return n.toFixed(2) + "%";
  }

  if (Math.abs(n) >= 10000000) {
    return (n / 10000000).toFixed(2) + " Cr";
  }

  if (Math.abs(n) >= 100000) {
    return (n / 100000).toFixed(2) + " L";
  }

  if (Math.abs(n) >= 1000) {
    return (n / 1000).toFixed(1) + "K";
  }

  if (Number.isInteger(n)) {
    return n.toLocaleString();
  }

  return n.toFixed(2);
}


function metrics() {

  const analytics = currentAnalytics();
  const ds = state.dataset;

  if (
    analytics?.kpis &&
    analytics.kpis.length
  ) {

    const apiMetrics =
      analytics.kpis
        .slice(0, 4)
        .map(kpi => [

          kpi.name,

          formatAnalyticsNumber(
            kpi.value,
            kpi.name
          ),

          kpi.aggregation === "count"
            ? "Count"
            : "Live API"

        ]);


    apiMetrics.push([
      "Data Quality",

      `${ds?.quality ?? 0}%`,

      "Verified"
    ]);


    return apiMetrics.slice(0, 5);
  }


  /* Local fallback only */

  let numeric = [];


  if (ds) {

    ds.headers.forEach(
      (header, index) => {

        const name =
          String(header).toLowerCase();


        const isId =
          name === "id" ||
          name.endsWith("_id") ||
          name.startsWith("id_") ||
          name.includes("order_id") ||
          name.includes("customer_id") ||
          name.includes("product_id") ||
          name.includes("employee_id") ||
          name.includes("invoice") ||
          name.includes("serial");


        if (
          ds.types[index] === "number" &&
          !isId
        ) {

          const values =
            ds.rows
              .map(row =>
                Number(
                  String(
                    row[index] || ""
                  ).replace(
                    /[₹,$,%]/g,
                    ""
                  )
                )
              )
              .filter(Number.isFinite);


          if (values.length) {

            numeric.push({

              name: header,

              sum:
                values.reduce(
                  (a, b) => a + b,
                  0
                ),

              avg:
                values.reduce(
                  (a, b) => a + b,
                  0
                ) / values.length

            });
          }
        }
      }
    );
  }


  return [

    [
      "Total Records",
      (
        ds?.rows.length || 0
      ).toLocaleString(),
      "Dataset"
    ],

    [
      numeric[0]?.name || "Metric 1",

      formatAnalyticsNumber(
        numeric[0]?.sum || 0
      ),

      "Local"
    ],

    [
      numeric[1]?.name || "Metric 2",

      formatAnalyticsNumber(
        numeric[1]?.sum || 0
      ),

      "Local"
    ],

    [
      "Data Quality",
      `${ds?.quality || 0}%`,
      "Local"
    ],

    [
      "Average",

      formatAnalyticsNumber(
        numeric[0]?.avg || 0
      ),

      "Local"
    ]
  ];
}


function trendSVG() {

  const analytics =
    currentAnalytics();

  const trend =
    analytics?.trend;


  if (
    !trend?.points ||
    trend.points.length < 2
  ) {

    return `
      <div
        class="empty"
        style="
          min-height:160px;
          display:flex;
          align-items:center;
          justify-content:center
        "
      >
        No usable date trend found in this dataset.
      </div>
    `;
  }


  const values =
    trend.points.map(
      p => Number(p.value)
    );


  const min =
    Math.min(...values);

  const max =
    Math.max(...values);


  const range =
    max - min || 1;


  const width = 600;
  const height = 180;

  const left = 12;
  const right = 12;
  const top = 20;
  const bottom = 25;


  const drawableWidth =
    width - left - right;


  const drawableHeight =
    height - top - bottom;


  const points =
    trend.points.map(
      (point, index) => {

        const x =
          left +
          (
            index /
            Math.max(
              trend.points.length - 1,
              1
            )
          ) *
          drawableWidth;


        const normalized =
          (
            Number(point.value) -
            min
          ) /
          range;


        const y =
          top +
          (
            1 -
            normalized
          ) *
          drawableHeight;


        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }
    ).join(" ");


  const firstPeriod =
    trend.points[0]?.period || "";


  const lastPeriod =
    trend.points[
      trend.points.length - 1
    ]?.period || "";


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
        <line
          x1="0"
          y1="150"
          x2="600"
          y2="150"
        />

        <line
          x1="0"
          y1="100"
          x2="600"
          y2="100"
        />

        <line
          x1="0"
          y1="50"
          x2="600"
          y2="50"
        />
      </g>

      <polyline
        points="${points}"
        fill="none"
        stroke="#35d28d"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

    </svg>

    <div
      class="legend"
      style="margin-top:8px"
    >

      <div>
        <span>
          ${esc(firstPeriod)}
        </span>

        <b>
          ${formatAnalyticsNumber(values[0])}
        </b>
      </div>

      <div>
        <span>
          ${esc(lastPeriod)}
        </span>

        <b>
          ${formatAnalyticsNumber(
            values[values.length - 1]
          )}
        </b>
      </div>

    </div>
  `;
}


function categoryHTML() {

  const analytics =
    currentAnalytics();


  const category =
    analytics?.category_mix;


  if (
    !category?.values ||
    !category.values.length
  ) {

    return `
      <div class="empty">
        No suitable category column found.
      </div>
    `;
  }


  const values =
    category.values.slice(0, 5);


  const colors = [
    "#2d7ff9",
    "#35d28d",
    "#7047eb",
    "#f1b94b",
    "#ef6f6c"
  ];


  let start = 0;


  const gradientParts =
    values.map(
      (item, index) => {

        const end =
          start +
          Number(
            item.percentage || 0
          );


        const part =
          `${colors[index % colors.length]} ${start}% ${end}%`;


        start = end;

        return part;
      }
    );


  if (start < 100) {

    gradientParts.push(
      `#243248 ${start}% 100%`
    );
  }


  return `
    <div
      style="
        width:115px;
        height:115px;
        border-radius:50%;
        margin:18px auto;
        position:relative;
        background:
          conic-gradient(
            ${gradientParts.join(",")}
          );
      "
    >

      <div
        style="
          position:absolute;
          inset:28px;
          border-radius:50%;
          background:var(--panel2);
        "
      ></div>

    </div>


    <div class="legend">

      ${
        values.map(
          (item, index) => `
            <div>

              <span>
                <span
                  style="
                    display:inline-block;
                    width:8px;
                    height:8px;
                    border-radius:50%;
                    background:${colors[index % colors.length]};
                    margin-right:5px
                  "
                ></span>

                ${esc(item.label)}
              </span>

              <b>
                ${Number(
                  item.percentage || 0
                ).toFixed(1)}%
              </b>

            </div>
          `
        ).join("")
      }

    </div>


    <p
      class="muted small"
      style="margin-top:10px"
    >
      Grouped by:
      ${esc(category.dimension)}
    </p>
  `;
}


function driversHTML() {

  const analytics =
    currentAnalytics();


  const drivers =
    analytics?.top_drivers;


  if (
    !drivers?.values ||
    !drivers.values.length
  ) {

    return `
      <div class="empty">
        No suitable performance driver found.
      </div>
    `;
  }


  return `
    <table class="table">

      <thead>
        <tr>

          <th>
            ${esc(drivers.dimension)}
          </th>

          <th>
            ${esc(drivers.metric)}
          </th>

        </tr>
      </thead>

      <tbody>

        ${
          drivers.values
            .slice(0, 6)
            .map(
              item => `
                <tr>

                  <td>
                    ${esc(item.label)}
                  </td>

                  <td>
                    ${formatAnalyticsNumber(
                      item.value,
                      drivers.metric
                    )}
                  </td>

                </tr>
              `
            ).join("")
        }

      </tbody>

    </table>
  `;
}


function insightsHTML() {

  const analytics =
    currentAnalytics();


  const insights =
    analytics?.insights;


  if (
    !insights ||
    !insights.length
  ) {

    return `
      <div class="empty">
        No server insights available yet.
      </div>
    `;
  }


  return `
    <div class="task-list">

      ${
        insights.map(
          insight => `
            <div class="task done">

              <span class="task-dot">
                ✓
              </span>

              <div>

                <b>
                  ${esc(insight.title)}
                </b>

                <small>
                  ${esc(insight.text)}
                </small>

              </div>

            </div>
          `
        ).join("")
      }

    </div>
  `;
}


function analysisHTML() {

  const analytics =
    currentAnalytics();


  const trendMetric =
    analytics?.trend?.metric ||
    "Performance";


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
          ${esc(trendMetric)} Trend
        </h3>

        ${trendSVG()}

      </div>


      <div class="card flat chart-card">

        <h3>
          Category Mix
        </h3>

        ${categoryHTML()}

      </div>


      <div class="card flat chart-card">

        <h3>
          Top Drivers
        </h3>

        ${driversHTML()}

      </div>

    </div>


    <div
      class="grid g2"
      style="margin-top:14px"
    >

      <div class="card flat">

        <h3>
          Evidence-Based Insights
        </h3>

        ${insightsHTML()}

      </div>


      <div class="card flat">

        <h3>
          Analysis Status
        </h3>

        <table class="table">

          <tbody>

            <tr>
              <td>
                Dataset
              </td>

              <td>
                ${
                  state.dataset
                    ? "✅ Loaded"
                    : "Demo"
                }
              </td>
            </tr>


            <tr>
              <td>
                Server API
              </td>

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
              <td>
                Analytics Engine
              </td>

              <td>
                ${
                  analytics
                    ? "✅ Live"
                    : "Local fallback"
                }
              </td>
            </tr>


            <tr>
              <td>
                Data Quality
              </td>

              <td>
                ${
                  state.dataset
                    ?.quality ??
                  0
                }%
              </td>
            </tr>


            <tr>
              <td>
                Domain
              </td>

              <td>
                ${esc(
                  state.dataset
                    ?.domain ||
                  "Business"
                )}
              </td>
            </tr>

          </tbody>

        </table>

      </div>

    </div>
  `;
}
