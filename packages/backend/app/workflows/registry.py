"""Inngest function registry — assembles ALL_FUNCTIONS for Inngest serve()."""
from app.phases import ALL_PHASE_FUNCTIONS
from app.workflows.credits import weekly_credit_reset

ALL_FUNCTIONS = ALL_PHASE_FUNCTIONS + [weekly_credit_reset]
