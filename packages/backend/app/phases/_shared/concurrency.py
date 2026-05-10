import inngest

DOC_CONCURRENCY = [inngest.Concurrency(limit=1, key="event.data.document_id")]
SECTION_CONCURRENCY = [inngest.Concurrency(limit=1, key="event.data.section_id")]
