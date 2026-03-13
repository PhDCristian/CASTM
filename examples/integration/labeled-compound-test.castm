// Labeled Compound Statements — Integration Test
//
// This kernel exercises labeled advanced statements and labeled function calls
// to validate end-to-end compilation of the new label syntax.
//
// Labels:
//   mainEntry:  labeled bundle (existing feature)
//   routePhase: labeled std::route(...) (NEW)
//   loadPhase:  labeled function call (NEW)

target base;
build {
    optimize O0;
    scheduler safe;
}

function loadAll(val) {
    bundle { at all: LWI R0, val; }
}

kernel "Labeled_Compound_Test" {
    io.load(0);
    io.store(700);

    // Labeled bundle (existing)
    mainEntry: bundle { at all: LWI R0, 42; }

    // Labeled advanced statement (NEW feature)
    routePhase: std::route(@0,0 -> @0,2, payload=R0, accum=R1);

    // Labeled function call (NEW feature)
    loadPhase: loadAll(720);

    bundle { @0,0: EXIT; }
}
