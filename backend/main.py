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


app = FastAPI(
    title="Buildlytics AI API",
    version="1.0.0",
    description="Backend API for Buildlytics AI",
)


# GitHub Pages frontend ko backend access dene ke liye
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
    allow_origins=list(dict.fromkeys(allowed_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Temporary in-memory project storage.
# Baad me isko database se replace karenge.
PROJECTS: dict[str, dict[str, Any]] = {}


class ProjectRequest(BaseModel):
    dataset_id: str
    tool: str
    level: str = "Intermediate"
    industry: str | None = None


def safe_name(name: str) -> str:
    name = re.sub(
        r"[^a-zA-Z0-9._-]+",
        "_",
        name or "dataset",
    )
    return name[:120]


def infer_domain(columns: list[str]) -> str:
    text = " ".join(c.lower() for c in columns)

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

    best = ("General Business", 0)

    for domain, keys in rules:
        score = sum(k in text for k in keys)

        if score > best[1]:
            best = (domain, score)

    return best[0]


def project_suggestions(domain: str) -> list[dict[str, str]]:
    return [
        {
            "tool": "Power BI",
            "title": f"{domain} Performance Dashboard",
            "difficulty": "Intermediate",
            "value": "High",
        },
        {
            "tool": "SQL",
            "title": f"{domain} Business Analysis",
            "difficulty": "Intermediate",
            "value": "High",
        },
        {
            "tool": "Python",
            "title": f"{domain} Exploratory Data Analysis",
            "difficulty": "Intermediate",
            "value": "High",
        },
        {
            "tool": "Machine Learning",
            "title": f"{domain} Prediction Project",
            "difficulty": "Advanced",
            "value": "High",
        },
    ]


def dataframe_summary(df: pd.DataFrame) -> dict[str, Any]:
    rows, cols = df.shape

    missing = int(df.isna().sum().sum())
    duplicates = int(df.duplicated().sum())

    numeric_cols = (
        df.select_dtypes(include="number")
        .columns.tolist()
    )

    date_like = [
        c
        for c in df.columns
        if any(
            k in c.lower()
            for k in [
                "date",
                "time",
                "month",
                "year",
            ]
        )
    ]

    categorical_cols = [
        c
        for c in df.columns
        if c not in numeric_cols
        and c not in date_like
    ]

    total_cells = max(rows * cols, 1)

    missing_ratio = missing / total_cells
    duplicate_ratio = duplicates / max(rows, 1)

    quality = round(
        max(
            0,
            100
            - (
                missing_ratio * 55
                + duplicate_ratio * 45
            )
            * 100,
        )
    )

    column_stats = []

    for c in df.columns[:80]:
        s = df[c]

        sample = (
            s.dropna()
            .astype(str)
            .head(3)
            .tolist()
        )

        column_stats.append(
            {
                "name": str(c),
                "dtype": str(s.dtype),
                "missing": int(s.isna().sum()),
                "unique": int(
                    s.nunique(dropna=True)
                ),
                "sample": sample,
            }
        )

    return {
        "rows": int(rows),
        "columns": int(cols),
        "missing_values": missing,
        "duplicate_rows": duplicates,
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "date_like_columns": date_like,
        "data_quality_score": quality,
        "column_stats": column_stats,
    }


@app.get("/")
def root():
    return {
        "service": "Buildlytics AI API",
        "status": "online",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "Buildlytics AI",
    }


@app.post("/upload-dataset")
async def upload_dataset(
    file: UploadFile = File(...)
):
    filename = safe_name(
        file.filename or "dataset.csv"
    )

    ext = (
        filename.lower().rsplit(".", 1)[-1]
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

    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File is larger than 25 MB.",
        )

    try:
        if ext == "csv":
            df = pd.read_csv(
                io.BytesIO(raw)
            )
        else:
            df = pd.read_excel(
                io.BytesIO(raw)
            )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read dataset: {exc}",
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="Dataset is empty.",
        )

    dataset_id = str(uuid.uuid4())

    summary = dataframe_summary(df)

    domain = infer_domain(
        [str(c) for c in df.columns]
    )

    PROJECTS[dataset_id] = {
        "dataset_id": dataset_id,
        "filename": filename,
        "domain": domain,
        "summary": summary,
    }

    return {
        "dataset_id": dataset_id,
        "filename": filename,
        "domain": domain,
        "summary": summary,
        "suggested_projects":
            project_suggestions(domain),
        "next_step": (
            "Choose a project/tool and "
            "call /generate-project."
        ),
    }


@app.post("/generate-project")
def generate_project(
    req: ProjectRequest
):
    data = PROJECTS.get(
        req.dataset_id
    )

    if not data:
        raise HTTPException(
            status_code=404,
            detail=(
                "Dataset session not found."
            ),
        )

    domain = (
        req.industry
        or data["domain"]
    )

    tool = req.tool.strip()
    level = req.level.strip()

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

    company = company_map.get(
        domain,
        "Aurevia Group",
    )

    title = (
        f"{company} — "
        f"{domain} "
        f"{tool} Analytics"
    )

    business_questions = [
        (
            "Which segments drive the "
            "strongest business performance?"
        ),
        (
            "Where is margin, efficiency "
            "or quality weakening?"
        ),
        (
            "Which factors best explain "
            "the change in performance?"
        ),
        (
            "What should management "
            "prioritize next?"
        ),
    ]

    project_id = str(
        uuid.uuid4()
    )

    project = {
        "project_id": project_id,
        "dataset_id":
            req.dataset_id,

        "title": title,
        "company": company,
        "role": "Data Analyst",
        "tool": tool,
        "level": level,
        "domain": domain,

        "status":
            "analysis_ready",

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
            data["summary"],

        "management_assignment": (
            f"Turn the uploaded "
            f"{domain.lower()} data into "
            f"clear business insights, "
            f"evidence and management "
            f"recommendations using {tool}."
        ),
    }

    PROJECTS[project_id] = project

    return project


@app.get("/project/{project_id}")
def get_project(
    project_id: str
):
    data = PROJECTS.get(
        project_id
    )

    if not data:
        raise HTTPException(
            status_code=404,
            detail="Project not found.",
        )

    return data


@app.post(
    "/verify-project/{project_id}"
)
def verify_project(
    project_id: str
):
    data = PROJECTS.get(
        project_id
    )

    if (
        not data
        or "dataset_summary"
        not in data
    ):
        raise HTTPException(
            status_code=404,
            detail="Project not found.",
        )

    quality = int(
        data["dataset_summary"].get(
            "data_quality_score",
            0,
        )
    )

    score = round(
        quality * 0.45 + 50
    )

    checks = [
        {
            "name":
                "Dataset readable",
            "passed": True,
        },
        {
            "name":
                "Data quality scan completed",
            "passed": True,
        },
        {
            "name":
                "Business questions attached",
            "passed": True,
        },
        {
            "name":
                "Project structure generated",
            "passed": True,
        },
    ]

    return {
        "project_id":
            project_id,

        "verified":
            score >= 70,

        "score":
            min(score, 100),

        "checks":
            checks,

        "note": (
            "Advanced code/DAX/SQL "
            "execution verification "
            "will be added in a later "
            "backend module."
        ),
    }
