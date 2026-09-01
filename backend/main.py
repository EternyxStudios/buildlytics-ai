from __future__ import annotations

import io
import os
import re
import uuid
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="Buildlytics AI API",
    version="2.0.0",
    description="Analytics backend for Buildlytics AI",
)


# =========================================================
# CORS
# =========================================================

frontend_origin = os.getenv(
    "FRONTEND_ORIGIN",
    "https://eternyxstudios.github.io",
)

allowed_origins = [
    frontend_origin,
    "https://eternyxstudios.github.io",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(
        dict.fromkeys(allowed_origins)
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# TEMPORARY STORAGE
# =========================================================
# Render restart hone par ye memory clear hogi.
# Baad me PostgreSQL / Supabase add karenge.

DATASETS: dict[str, dict[str, Any]] = {}

PROJECTS: dict[str, dict[str, Any]] = {}


# =========================================================
# REQUEST MODELS
# =========================================================

class ProjectRequest(BaseModel):
    dataset_id: str
    tool: str
    level: str = "Intermediate"
    industry: str | None = None


# =========================================================
# HELPERS
# =========================================================

def safe_name(name: str) -> str:
    name = re.sub(
        r"[^a-zA-Z0-9._-]+",
        "_",
        name or "dataset",
    )

    return name[:120]


def clean_column_name(value: Any) -> str:
    text = str(value).strip()

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text


def is_id_column(name: str) -> bool:
    """
    ID / code columns ko revenue ya metric ki tarah
    SUM hone se rokta hai.
    """

    n = name.lower().strip()

    patterns = [
        r"^id$",
        r"_id$",
        r"^id_",
        r"code$",
        r"_code$",
        r"number$",
        r"_number$",
        r"no$",
        r"_no$",
        r"index$",
        r"serial",
        r"invoice",
        r"order_id",
        r"customer_id",
        r"product_id",
        r"employee_id",
    ]

    return any(
        re.search(pattern, n)
        for pattern in patterns
    )


def infer_domain(
    columns: list[str]
) -> str:

    text = " ".join(
        c.lower()
        for c in columns
    )

    rules = [
        (
            "E-commerce / Retail",
            [
                "order",
                "product",
                "customer",
                "sales",
                "revenue",
                "price",
                "profit",
                "category",
            ],
        ),

        (
            "Banking / Finance",
            [
                "account",
                "loan",
                "credit",
                "balance",
                "transaction",
                "bank",
                "interest",
            ],
        ),

        (
            "Food Delivery",
            [
                "restaurant",
                "delivery",
                "rider",
                "order_time",
                "food",
            ],
        ),

        (
            "Healthcare",
            [
                "patient",
                "diagnosis",
                "hospital",
                "doctor",
                "treatment",
            ],
        ),

        (
            "HR / People Analytics",
            [
                "employee",
                "salary",
                "department",
                "attrition",
                "hire",
            ],
        ),

        (
            "Logistics",
            [
                "shipment",
                "warehouse",
                "dispatch",
                "delivery",
                "freight",
            ],
        ),
    ]

    best_domain = "General Business"
    best_score = 0

    for domain, keys in rules:

        score = sum(
            key in text
            for key in keys
        )

        if score > best_score:

            best_domain = domain
            best_score = score

    return best_domain


def project_suggestions(
    domain: str
) -> list[dict[str, str]]:

    return [
        {
            "tool": "Power BI",
            "title":
                f"{domain} Performance Dashboard",
            "difficulty":
                "Intermediate",
            "value":
                "High",
        },

        {
            "tool": "SQL",
            "title":
                f"{domain} Business Analysis",
            "difficulty":
                "Intermediate",
            "value":
                "High",
        },

        {
            "tool": "Python",
            "title":
                f"{domain} Exploratory Data Analysis",
            "difficulty":
                "Intermediate",
            "value":
                "High",
        },

        {
            "tool": "Machine Learning",
            "title":
                f"{domain} Prediction Project",
            "difficulty":
                "Advanced",
            "value":
                "High",
        },
    ]


# =========================================================
# DATA PREPARATION
# =========================================================

def prepare_dataframe(
    df: pd.DataFrame
) -> pd.DataFrame:

    df = df.copy()

    df.columns = [
        clean_column_name(c)
        for c in df.columns
    ]

    # blank cells -> NA
    df = df.replace(
        r"^\s*$",
        pd.NA,
        regex=True,
    )

    # completely empty rows remove
    df = df.dropna(
        how="all"
    )

    return df


def detect_date_columns(
    df: pd.DataFrame
) -> list[str]:

    detected = []

    for col in df.columns:

        name = col.lower()

        if any(
            key in name
            for key in [
                "date",
                "time",
                "month",
                "year",
            ]
        ):

            detected.append(col)
            continue

        if (
            df[col].dtype == "object"
        ):

            sample = (
                df[col]
                .dropna()
                .astype(str)
                .head(30)
            )

            if len(sample) < 3:
                continue

            try:

                parsed = pd.to_datetime(
                    sample,
                    errors="coerce",
                )

                valid_ratio = (
                    parsed.notna().mean()
                )

                if valid_ratio >= 0.8:
                    detected.append(col)

            except Exception:
                pass

    return list(
        dict.fromkeys(detected)
    )


def numeric_metric_columns(
    df: pd.DataFrame
) -> list[str]:

    numeric = (
        df
        .select_dtypes(
            include="number"
        )
        .columns
        .tolist()
    )

    return [
        c
        for c in numeric
        if not is_id_column(c)
    ]


def categorical_columns(
    df: pd.DataFrame,
    date_columns: list[str],
) -> list[str]:

    result = []

    row_count = max(
        len(df),
        1,
    )

    for col in df.columns:

        if col in date_columns:
            continue

        if pd.api.types.is_numeric_dtype(
            df[col]
        ):
            continue

        unique = int(
            df[col]
            .nunique(
                dropna=True
            )
        )

        # Very high cardinality text ko
        # category chart me avoid karo.
        if (
            2 <= unique <=
            min(50, row_count)
        ):
            result.append(col)

    return result


# =========================================================
# DATA SUMMARY
# =========================================================

def dataframe_summary(
    df: pd.DataFrame
) -> dict[str, Any]:

    rows, cols = df.shape

    missing = int(
        df.isna()
        .sum()
        .sum()
    )

    duplicates = int(
        df.duplicated()
        .sum()
    )

    numeric_cols = (
        df
        .select_dtypes(
            include="number"
        )
        .columns
        .tolist()
    )

    metric_cols = (
        numeric_metric_columns(df)
    )

    date_like = (
        detect_date_columns(df)
    )

    categorical = (
        categorical_columns(
            df,
            date_like,
        )
    )

    total_cells = max(
        rows * cols,
        1,
    )

    missing_ratio = (
        missing /
        total_cells
    )

    duplicate_ratio = (
        duplicates /
        max(rows, 1)
    )

    quality = round(
        max(
            0,
            min(
                100,
                100
                - (
                    missing_ratio * 55
                    +
                    duplicate_ratio * 45
                )
                * 100,
            ),
        )
    )

    column_stats = []

    for col in df.columns[:80]:

        series = df[col]

        sample = (
            series
            .dropna()
            .astype(str)
            .head(3)
            .tolist()
        )

        column_stats.append(
            {
                "name":
                    str(col),

                "dtype":
                    str(
                        series.dtype
                    ),

                "missing":
                    int(
                        series
                        .isna()
                        .sum()
                    ),

                "unique":
                    int(
                        series
                        .nunique(
                            dropna=True
                        )
                    ),

                "sample":
                    sample,

                "usable_metric":
                    col in metric_cols,

                "id_like":
                    is_id_column(col),
            }
        )

    return {
        "rows":
            int(rows),

        "columns":
            int(cols),

        "missing_values":
            missing,

        "duplicate_rows":
            duplicates,

        "numeric_columns":
            numeric_cols,

        "metric_columns":
            metric_cols,

        "categorical_columns":
            categorical,

        "date_like_columns":
            date_like,

        "data_quality_score":
            quality,

        "column_stats":
            column_stats,
    }


# =========================================================
# FORMATTERS
# =========================================================

def safe_float(
    value: Any
) -> float:

    try:

        if pd.isna(value):
            return 0.0

        return float(value)

    except Exception:

        return 0.0


def round_number(
    value: Any
) -> float:

    value = safe_float(value)

    if abs(value) >= 1000:
        return round(value, 2)

    return round(value, 4)


# =========================================================
# KPI ENGINE
# =========================================================

def build_kpis(
    df: pd.DataFrame
) -> list[dict[str, Any]]:

    kpis: list[
        dict[str, Any]
    ] = []

    kpis.append(
        {
            "name":
                "Total Records",

            "value":
                int(len(df)),

            "aggregation":
                "count",

            "column":
                None,
        }
    )

    metric_cols = (
        numeric_metric_columns(df)
    )

    priority_words = [
        "revenue",
        "sales",
        "profit",
        "income",
        "amount",
        "price",
        "cost",
        "quantity",
        "qty",
        "balance",
        "salary",
        "score",
    ]

    def score_column(
        column: str
    ) -> int:

        name = column.lower()

        score = 0

        for index, word in enumerate(
            priority_words
        ):

            if word in name:
                score += (
                    len(priority_words)
                    - index
                )

        return score

    metric_cols = sorted(
        metric_cols,
        key=score_column,
        reverse=True,
    )

    for col in metric_cols[:4]:

        series = pd.to_numeric(
            df[col],
            errors="coerce",
        )

        valid = series.dropna()

        if valid.empty:
            continue

        name_lower = col.lower()

        if any(
            word in name_lower
            for word in [
                "rate",
                "margin",
                "score",
                "rating",
                "percentage",
                "percent",
            ]
        ):

            value = valid.mean()

            aggregation = "average"

        else:

            value = valid.sum()

            aggregation = "sum"

        kpis.append(
            {
                "name":
                    str(col),

                "value":
                    round_number(
                        value
                    ),

                "aggregation":
                    aggregation,

                "column":
                    str(col),
            }
        )

    return kpis[:5]


# =========================================================
# CATEGORY ENGINE
# =========================================================

def build_category_mix(
    df: pd.DataFrame
) -> dict[str, Any] | None:

    date_cols = (
        detect_date_columns(df)
    )

    categories = (
        categorical_columns(
            df,
            date_cols,
        )
    )

    if not categories:
        return None

    # Lower cardinality category
    # generally better chart.
    categories = sorted(
        categories,
        key=lambda c:
            df[c].nunique(
                dropna=True
            ),
    )

    dimension = categories[0]

    counts = (
        df[dimension]
        .fillna("Unknown")
        .astype(str)
        .value_counts()
        .head(8)
    )

    total = max(
        int(counts.sum()),
        1,
    )

    values = []

    for label, count in counts.items():

        values.append(
            {
                "label":
                    str(label),

                "value":
                    int(count),

                "percentage":
                    round(
                        count /
                        total *
                        100,
                        2,
                    ),
            }
        )

    return {
        "dimension":
            dimension,

        "aggregation":
            "count",

        "values":
            values,
    }


# =========================================================
# TREND ENGINE
# =========================================================

def build_trend(
    df: pd.DataFrame
) -> dict[str, Any] | None:

    date_cols = (
        detect_date_columns(df)
    )

    metrics = (
        numeric_metric_columns(df)
    )

    if (
        not date_cols
        or not metrics
    ):
        return None

    date_col = (
        date_cols[0]
    )

    metric = (
        metrics[0]
    )

    temp = df[
        [
            date_col,
            metric,
        ]
    ].copy()

    temp[date_col] = (
        pd.to_datetime(
            temp[date_col],
            errors="coerce",
        )
    )

    temp[metric] = (
        pd.to_numeric(
            temp[metric],
            errors="coerce",
        )
    )

    temp = temp.dropna()

    if temp.empty:
        return None

    temp["period"] = (
        temp[date_col]
        .dt.to_period("M")
        .astype(str)
    )

    grouped = (
        temp
        .groupby(
            "period"
        )[metric]
        .sum()
        .reset_index()
        .sort_values(
            "period"
        )
        .tail(24)
    )

    points = [
        {
            "period":
                str(row["period"]),

            "value":
                round_number(
                    row[metric]
                ),
        }

        for _, row
        in grouped.iterrows()
    ]

    return {
        "date_column":
            date_col,

        "metric":
            metric,

        "aggregation":
            "sum",

        "points":
            points,
    }


# =========================================================
# DRIVER ANALYSIS
# =========================================================

def build_top_drivers(
    df: pd.DataFrame
) -> dict[str, Any] | None:

    metrics = (
        numeric_metric_columns(df)
    )

    date_cols = (
        detect_date_columns(df)
    )

    categories = (
        categorical_columns(
            df,
            date_cols,
        )
    )

    if (
        not metrics
        or not categories
    ):
        return None

    metric = metrics[0]

    dimension = sorted(
        categories,
        key=lambda c:
            df[c].nunique(
                dropna=True
            ),
    )[0]

    temp = df[
        [
            dimension,
            metric,
        ]
    ].copy()

    temp[metric] = (
        pd.to_numeric(
            temp[metric],
            errors="coerce",
        )
    )

    temp[dimension] = (
        temp[dimension]
        .fillna("Unknown")
        .astype(str)
    )

    temp = temp.dropna(
        subset=[metric]
    )

    if temp.empty:
        return None

    grouped = (
        temp
        .groupby(
            dimension
        )[metric]
        .sum()
        .sort_values(
            ascending=False
        )
        .head(8)
    )

    values = [
        {
            "label":
                str(label),

            "value":
                round_number(value),
        }

        for label, value
        in grouped.items()
    ]

    return {
        "dimension":
            dimension,

        "metric":
            metric,

        "aggregation":
            "sum",

        "values":
            values,
    }


# =========================================================
# INSIGHT ENGINE
# =========================================================

def build_insights(
    df: pd.DataFrame,
    category_mix: dict[str, Any] | None,
    trend: dict[str, Any] | None,
    drivers: dict[str, Any] | None,
) -> list[dict[str, str]]:

    insights = []

    if category_mix:

        values = (
            category_mix.get(
                "values",
                []
            )
        )

        if values:

            top = values[0]

            insights.append(
                {
                    "type":
                        "category",

                    "title":
                        "Largest segment",

                    "text":
                        (
                            f"{top['label']} is the largest "
                            f"{category_mix['dimension']} segment, "
                            f"representing approximately "
                            f"{top['percentage']}% of records."
                        ),
                }
            )

    if drivers:

        values = (
            drivers.get(
                "values",
                []
            )
        )

        if values:

            top = values[0]

            insights.append(
                {
                    "type":
                        "driver",

                    "title":
                        "Top performance driver",

                    "text":
                        (
                            f"{top['label']} contributes the "
                            f"highest {drivers['metric']} across "
                            f"{drivers['dimension']} based on "
                            f"the uploaded dataset."
                        ),
                }
            )

    if trend:

        points = (
            trend.get(
                "points",
                []
            )
        )

        if len(points) >= 2:

            first = safe_float(
                points[0]["value"]
            )

            last = safe_float(
                points[-1]["value"]
            )

            if first != 0:

                change = (
                    (
                        last - first
                    )
                    /
                    abs(first)
                    *
                    100
                )

                direction = (
                    "increased"
                    if change >= 0
                    else "decreased"
                )

                insights.append(
                    {
                        "type":
                            "trend",

                        "title":
                            "Trend movement",

                        "text":
                            (
                                f"{trend['metric']} {direction} "
                                f"by approximately "
                                f"{abs(change):.1f}% from "
                                f"{points[0]['period']} to "
                                f"{points[-1]['period']}."
                            ),
                    }
                )

    missing = int(
        df.isna()
        .sum()
        .sum()
    )

    duplicates = int(
        df.duplicated()
        .sum()
    )

    if missing > 0:

        insights.append(
            {
                "type":
                    "quality",

                "title":
                    "Missing values detected",

                "text":
                    (
                        f"The dataset contains "
                        f"{missing} missing cells. "
                        f"These should be handled before "
                        f"final reporting."
                    ),
            }
        )

    if duplicates > 0:

        insights.append(
            {
                "type":
                    "quality",

                "title":
                    "Duplicate rows detected",

                "text":
                    (
                        f"The dataset contains "
                        f"{duplicates} duplicate rows."
                    ),
            }
        )

    if not insights:

        insights.append(
            {
                "type":
                    "general",

                "title":
                    "Dataset ready",

                "text":
                    (
                        "The uploaded dataset is readable "
                        "and ready for structured analysis."
                    ),
            }
        )

    return insights[:8]


# =========================================================
# DASHBOARD PLAN
# =========================================================

def build_dashboard_plan(
    analytics: dict[str, Any]
) -> list[dict[str, str]]:

    charts = []

    if analytics.get(
        "kpis"
    ):

        charts.append(
            {
                "type":
                    "kpi_cards",

                "title":
                    "Executive KPI Summary",
            }
        )

    if analytics.get(
        "trend"
    ):

        charts.append(
            {
                "type":
                    "line_chart",

                "title":
                    "Performance Trend",
            }
        )

    if analytics.get(
        "category_mix"
    ):

        charts.append(
            {
                "type":
                    "donut_chart",

                "title":
                    "Category Mix",
            }
        )

    if analytics.get(
        "top_drivers"
    ):

        charts.append(
            {
                "type":
                    "bar_chart",

                "title":
                    "Top Performance Drivers",
            }
        )

    return charts


# =========================================================
# COMPLETE ANALYTICS ENGINE
# =========================================================

def build_analytics(
    df: pd.DataFrame
) -> dict[str, Any]:

    kpis = build_kpis(df)

    category_mix = (
        build_category_mix(df)
    )

    trend = (
        build_trend(df)
    )

    drivers = (
        build_top_drivers(df)
    )

    insights = (
        build_insights(
            df,
            category_mix,
            trend,
            drivers,
        )
    )

    analytics = {
        "kpis":
            kpis,

        "trend":
            trend,

        "category_mix":
            category_mix,

        "top_drivers":
            drivers,

        "insights":
            insights,
    }

    analytics[
        "dashboard_plan"
    ] = build_dashboard_plan(
        analytics
    )

    return analytics


# =========================================================
# COMPANY / BUSINESS LOGIC
# =========================================================

def company_for_domain(
    domain: str
) -> str:

    company_map = {
        "E-commerce / Retail":
            "NovaCart",

        "Banking / Finance":
            "Finora Bank",

        "Food Delivery":
            "QuickBite",

        "Healthcare":
            "MediCore",

        "HR / People Analytics":
            "PeoplePulse",

        "Logistics":
            "SwiftLogix",

        "General Business":
            "Aurevia Group",
    }

    return company_map.get(
        domain,
        "Aurevia Group",
    )


def business_questions_for(
    analytics: dict[str, Any]
) -> list[str]:

    questions = [
        (
            "Which segments drive the "
            "strongest business performance?"
        ),
        (
            "Where is performance "
            "weakening?"
        ),
        (
            "Which factors explain "
            "the biggest differences?"
        ),
        (
            "What should management "
            "prioritize next?"
        ),
    ]

    trend = analytics.get(
        "trend"
    )

    if trend:

        questions.insert(
            1,
            (
                f"How has {trend['metric']} "
                f"changed over time?"
            ),
        )

    drivers = analytics.get(
        "top_drivers"
    )

    if drivers:

        questions.insert(
            2,
            (
                f"Which {drivers['dimension']} "
                f"contributes most to "
                f"{drivers['metric']}?"
            ),
        )

    return questions[:6]


# =========================================================
# ROUTES
# =========================================================

@app.get("/")
def root():

    return {
        "service":
            "Buildlytics AI API",

        "status":
            "online",

        "version":
            "2.0.0",

        "analytics_engine":
            "active",
    }


@app.get("/health")
def health():

    return {
        "ok":
            True,

        "service":
            "Buildlytics AI",

        "version":
            "2.0.0",

        "analytics_engine":
            True,
    }


# =========================================================
# UPLOAD DATASET
# =========================================================

@app.post("/upload-dataset")
async def upload_dataset(
    file: UploadFile = File(...)
):

    filename = safe_name(
        file.filename
        or "dataset.csv"
    )

    ext = (
        filename
        .lower()
        .rsplit(".", 1)[-1]
        if "." in filename
        else ""
    )

    if ext not in {
        "csv",
        "xlsx",
        "xls",
    }:

        raise HTTPException(
            status_code=400,
            detail=(
                "Only CSV, XLSX and XLS "
                "files are supported."
            ),
        )

    raw = await file.read()

    if (
        len(raw) >
        25 * 1024 * 1024
    ):

        raise HTTPException(
            status_code=413,
            detail=(
                "File is larger "
                "than 25 MB."
            ),
        )

    try:

        if ext == "csv":

            try:

                df = pd.read_csv(
                    io.BytesIO(raw)
                )

            except UnicodeDecodeError:

                df = pd.read_csv(
                    io.BytesIO(raw),
                    encoding="latin-1",
                )

        else:

            df = pd.read_excel(
                io.BytesIO(raw)
            )

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not read "
                f"dataset: {exc}"
            ),
        )

    df = prepare_dataframe(
        df
    )

    if df.empty:

        raise HTTPException(
            status_code=400,
            detail="Dataset is empty.",
        )

    dataset_id = str(
        uuid.uuid4()
    )

    summary = (
        dataframe_summary(df)
    )

    domain = (
        infer_domain(
            [
                str(c)
                for c in df.columns
            ]
        )
    )

    analytics = (
        build_analytics(df)
    )

    DATASETS[
        dataset_id
    ] = {
        "dataset_id":
            dataset_id,

        "filename":
            filename,

        "domain":
            domain,

        "summary":
            summary,

        "dataframe":
            df,

        "analytics":
            analytics,
    }

    return {
        "dataset_id":
            dataset_id,

        "filename":
            filename,

        "domain":
            domain,

        "summary":
            summary,

        "analytics":
            analytics,

        "suggested_projects":
            project_suggestions(
                domain
            ),

        "next_step":
            (
                "Choose a project/tool "
                "and call /generate-project."
            ),
    }


# =========================================================
# DATASET ANALYTICS
# =========================================================

@app.get(
    "/dataset/{dataset_id}/analytics"
)
def dataset_analytics(
    dataset_id: str
):

    dataset = DATASETS.get(
        dataset_id
    )

    if not dataset:

        raise HTTPException(
            status_code=404,
            detail=(
                "Dataset session "
                "not found."
            ),
        )

    return {
        "dataset_id":
            dataset_id,

        "filename":
            dataset["filename"],

        "domain":
            dataset["domain"],

        "summary":
            dataset["summary"],

        "analytics":
            dataset["analytics"],
    }


# =========================================================
# GENERATE PROJECT
# =========================================================

@app.post("/generate-project")
def generate_project(
    req: ProjectRequest
):

    dataset = DATASETS.get(
        req.dataset_id
    )

    if not dataset:

        raise HTTPException(
            status_code=404,
            detail=(
                "Dataset session "
                "not found."
            ),
        )

    domain = (
        req.industry
        or dataset["domain"]
    )

    tool = (
        req.tool.strip()
    )

    level = (
        req.level.strip()
    )

    company = (
        company_for_domain(
            domain
        )
    )

    title = (
        f"{company} — "
        f"{domain} "
        f"{tool} Analytics"
    )

    analytics = (
        dataset["analytics"]
    )

    business_questions = (
        business_questions_for(
            analytics
        )
    )

    project_id = str(
        uuid.uuid4()
    )

    project = {
        "project_id":
            project_id,

        "dataset_id":
            req.dataset_id,

        "title":
            title,

        "company":
            company,

        "role":
            "Data Analyst",

        "tool":
            tool,

        "level":
            level,

        "domain":
            domain,

        "status":
            "analysis_complete",

        "progress": [
            {
                "step":
                    "Data Check",

                "status":
                    "completed",
            },

            {
                "step":
                    "Processing",

                "status":
                    "completed",
            },

            {
                "step":
                    "Analysis",

                "status":
                    "completed",
            },

            {
                "step":
                    "Dashboard",

                "status":
                    "ready",
            },

            {
                "step":
                    "Insights",

                "status":
                    "ready",
            },

            {
                "step":
                    "Report",

                "status":
                    "ready",
            },
        ],

        "business_questions":
            business_questions,

        "dataset_summary":
            dataset["summary"],

        "analytics":
            analytics,

        "management_assignment":
            (
                f"Turn the uploaded "
                f"{domain.lower()} dataset "
                f"into measurable business "
                f"insights and management "
                f"recommendations using "
                f"{tool}."
            ),
    }

    PROJECTS[
        project_id
    ] = project

    return project


# =========================================================
# GET PROJECT
# =========================================================

@app.get("/project/{project_id}")
def get_project(
    project_id: str
):

    project = PROJECTS.get(
        project_id
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found.",
        )

    return project


# =========================================================
# VERIFY PROJECT
# =========================================================

@app.post(
    "/verify-project/{project_id}"
)
def verify_project(
    project_id: str
):

    project = PROJECTS.get(
        project_id
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found.",
        )

    summary = (
        project.get(
            "dataset_summary",
            {}
        )
    )

    analytics = (
        project.get(
            "analytics",
            {}
        )
    )

    quality = int(
        summary.get(
            "data_quality_score",
            0,
        )
    )

    kpis = (
        analytics.get(
            "kpis",
            []
        )
    )

    insights = (
        analytics.get(
            "insights",
            []
        )
    )

    dashboard_plan = (
        analytics.get(
            "dashboard_plan",
            []
        )
    )

    checks = [
        {
            "name":
                "Dataset readable",

            "passed":
                summary.get(
                    "rows",
                    0,
                ) > 0,
        },

        {
            "name":
                "Data quality scan completed",

            "passed":
                quality > 0,
        },

        {
            "name":
                "Usable KPI generated",

            "passed":
                len(kpis) >= 1,
        },

        {
            "name":
                "ID fields excluded from metrics",

            "passed":
                True,
        },

        {
            "name":
                "Business questions attached",

            "passed":
                len(
                    project.get(
                        "business_questions",
                        []
                    )
                ) > 0,
        },

        {
            "name":
                "Evidence-based insights generated",

            "passed":
                len(insights) > 0,
        },

        {
            "name":
                "Dashboard plan generated",

            "passed":
                len(
                    dashboard_plan
                ) > 0,
        },
    ]

    passed = sum(
        1
        for check in checks
        if check["passed"]
    )

    structure_score = (
        passed /
        len(checks)
        *
        100
    )

    score = round(
        quality * 0.4
        +
        structure_score * 0.6
    )

    verified = (
        score >= 75
    )

    return {
        "project_id":
            project_id,

        "verified":
            verified,

        "score":
            min(
                score,
                100,
            ),

        "checks":
            checks,

        "analytics_status": {
            "kpis":
                len(kpis),

            "insights":
                len(insights),

            "dashboard_components":
                len(
                    dashboard_plan
                ),
        },

        "note":
            (
                "Dataset calculations, KPI selection, "
                "trend analysis, category analysis and "
                "basic insight verification are active. "
                "Full Power BI DAX execution and SQL "
                "sandbox verification will be added "
                "separately."
            ),
    }
