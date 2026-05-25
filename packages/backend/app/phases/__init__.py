from app.phases.alignment import function as _alignment_fn
from app.phases.audit import function as _audit_fn
from app.phases.completion import function as _completion_fn
from app.phases.discovery import function as _discovery_fn
from app.phases.generation import function as _generation_fn
from app.phases.refinement import action_function as _refinement_action_fn
from app.phases.refinement import start_function as _refinement_start_fn

ALL_PHASE_FUNCTIONS = [
    _discovery_fn,
    _alignment_fn,
    _generation_fn,
    _refinement_start_fn,
    _refinement_action_fn,
    _audit_fn,
    _completion_fn,
]
