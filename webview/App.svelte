<script lang="ts">
  import { onMount } from "svelte";
  import {
    BoardView,
    GameLog,
    GameRunner,
    MatchCharts,
    MatchStatsTracker,
    PlaybackControls,
    TeamStats,
    buildReplay,
    defaultDragonSkin,
    defaultMapSkin,
    type LoadedReplay,
  } from "@battledragon/visualiser";
  import {
    newAnnotation,
    newResearchDocument,
    parseResearchDocument,
    type MapHighlight,
    type ResearchAnnotation,
    type ResearchDocument,
  } from "../src/research";
  import { detectSequenceCandidates, sequenceCandidateToAnnotation, type SequenceCandidate } from "../src/sequences";
  import { REPLAY_FORMAT_VERSION } from "../vendor/unswbc/packages/visualiser/src/replay/generated/replay";

  const api = acquireVsCodeApi();
  let loaded: LoadedReplay | undefined = $state();
  let runner: GameRunner | undefined = $state();
  let research: ResearchDocument | undefined = $state();
  let candidates: SequenceCandidate[] = $state([]);
  let selectedId: string | undefined = $state();
  let tab: "research" | "log" | "info" = $state("research");
  let fileName = $state("");
  let errorMessage: string | undefined = $state();
  let notice = $state("");
  let mapPick = $state(false);

  const selected = $derived(research?.annotations.find((item) => item.id === selectedId));
  const tracker = $derived(loaded ? new MatchStatsTracker(loaded.match) : undefined);
  const stats = $derived(loaded && runner && tracker ? tracker.statsAt(runner.round) : undefined);

  function touch(annotation?: ResearchAnnotation) {
    if (!research) return;
    const now = new Date().toISOString();
    research.updatedAt = now;
    if (annotation) annotation.provenance.updatedAt = now;
  }

  function add(kind: "general" | "point" | "range") {
    if (!research || !runner) return;
    const annotation = newAnnotation(kind, "VS Code user", { round: runner.round });
    research.annotations.push(annotation);
    selectedId = annotation.id;
    tab = "research";
    touch(annotation);
  }

  function addCandidate(candidate: SequenceCandidate) {
    if (!research) return;
    const existing = research.annotations.find((item) => item.id === candidate.id);
    if (existing) {
      selectedId = existing.id;
      return;
    }
    const annotation = sequenceCandidateToAnnotation(candidate);
    research.annotations.push(annotation);
    selectedId = annotation.id;
    touch(annotation);
  }

  function removeSelected() {
    if (!research || !selectedId) return;
    research.annotations = research.annotations.filter((item) => item.id !== selectedId);
    selectedId = undefined;
    touch();
  }

  function jump(round: number) {
    if (!runner || !loaded) return;
    runner.pause();
    runner.seek(loaded.match.positionOf(round, 0, runner.granularity));
  }

  function setRangeEnd() {
    if (!selected || selected.kind !== "range" || !runner) return;
    selected.end = { round: runner.round };
    if (selected.start && selected.end.round < selected.start.round) [selected.start, selected.end] = [selected.end, selected.start];
    touch(selected);
  }

  function toggleCell(x: number, y: number) {
    if (!selected) return;
    selected.highlights ??= [];
    const at = selected.highlights.findIndex((h) => h.kind === "cell" && h.x === x && h.y === y);
    if (at >= 0) selected.highlights.splice(at, 1);
    else selected.highlights.push({ kind: "cell", x, y, label: "Focus" });
    touch(selected);
  }

  function boardClick(event: MouseEvent, projection: { unproject: (x: number, y: number) => { x: number; y: number } }) {
    if (!mapPick) return;
    const element = event.currentTarget as HTMLElement;
    const box = element.getBoundingClientRect();
    const point = projection.unproject(event.clientX - box.left, event.clientY - box.top);
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    const board = loaded?.match.roundAt(0).map;
    if (board && x >= 0 && y >= 0 && x < board.width && y < board.height) toggleCell(x, y);
  }

  function highlightRects(annotation: ResearchAnnotation | undefined): Array<MapHighlight & { x: number; y: number; width: number; height: number }> {
    if (!annotation || !loaded || !runner) return [];
    const out: Array<MapHighlight & { x: number; y: number; width: number; height: number }> = [];
    for (const highlight of annotation.highlights ?? []) {
      if (highlight.kind === "cell") out.push({ ...highlight, width: 1, height: 1 });
      if (highlight.kind === "rect") out.push(highlight);
      if (highlight.kind === "dragon") {
        const dragon = loaded.match.roundAt(runner.round).bodies.getById(highlight.id);
        for (const cell of dragon?.body ?? []) out.push({ ...highlight, x: cell.x, y: cell.y, width: 1, height: 1 });
      }
    }
    return out;
  }

  async function sha256(bytes: Uint8Array): Promise<string> {
    const copy = Uint8Array.from(bytes).buffer;
    const digest = await crypto.subtle.digest("SHA-256", copy);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function open(bytes: Uint8Array, name: string, researchText?: string) {
    try {
      notice = "";
      mapPick = false;
      loaded = buildReplay(bytes);
      runner = new GameRunner(loaded.match);
      fileName = name;
      const identity = {
        sha256: await sha256(bytes),
        filename: name,
        formatVersion: REPLAY_FORMAT_VERSION,
        mapName: loaded.match.roundAt(0).map.staticMap.mapName || undefined,
        rounds: loaded.match.maxRound,
      };
      research = researchText ? parseResearchDocument(researchText) : newResearchDocument(identity);
      if (research.replay.sha256 !== identity.sha256) {
        notice = "Warning: this sidecar was created for different replay bytes. Review it before saving.";
      }
      candidates = detectSequenceCandidates(loaded);
      selectedId = research.annotations[0]?.id;
      errorMessage = undefined;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function save(saveAs = false) {
    if (!research) return;
    touch(selected);
    api.postMessage({ type: saveAs ? "saveAs" : "save", document: research });
  }

  onMount(() => {
    const receive = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === "open") void open(new Uint8Array(message.replayBytes), message.name, message.researchText);
      else if (message?.type === "error" || message?.type === "save-error") errorMessage = message.message;
      else if (message?.type === "saved") notice = `Saved ${message.path}`;
    };
    window.addEventListener("message", receive);
    api.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", receive);
  });
</script>

{#if errorMessage}
  <div class="message error"><strong>Could not open research studio</strong><span>{errorMessage}</span></div>
{:else if loaded && runner && research}
  <main class="studio">
    <header>
      <div><strong>Battlecode Research Studio</strong><span>{fileName} · {research.replay.mapName ?? "unknown map"}</span></div>
      <div class="header-actions">
        <button onclick={() => save(false)}>Save sidecar</button>
        <button class="quiet" onclick={() => save(true)}>Save as…</button>
      </div>
    </header>
    {#if notice}<button class="notice" onclick={() => (notice = "")}>{notice}</button>{/if}

    <div class="workspace">
      <aside>
        <nav aria-label="Replay panels">
          <button class:on={tab === "research"} onclick={() => (tab = "research")}>Research</button>
          <button class:on={tab === "log"} onclick={() => (tab = "log")}>Game log</button>
          <button class:on={tab === "info"} onclick={() => (tab = "info")}>Info</button>
        </nav>

        {#if tab === "research"}
          <section class="research-panel">
            <div class="new-buttons">
              <button onclick={() => add("point")}>+ Point</button>
              <button onclick={() => add("range")}>+ Range</button>
              <button onclick={() => add("general")}>+ General</button>
            </div>

            <details open={research.annotations.length === 0}>
              <summary>Detected sequences <span>{candidates.length}</span></summary>
              <p class="hint">Repeated exact sonar payloads followed by a consistent next action. These are leads, not proof of causation.</p>
              <div class="candidate-list">
                {#each candidates.slice(0, 30) as candidate (candidate.id)}
                  <button onclick={() => addCandidate(candidate)}>
                    <b>#{candidate.senderId} → #{candidate.receiverId}</b>
                    <span>{candidate.payloadHex} · {candidate.occurrences.length}× · {candidate.response}</span>
                  </button>
                {/each}
              </div>
            </details>

            <div class="annotation-list" aria-label="Annotations">
              {#each research.annotations as annotation (annotation.id)}
                <button class:on={selectedId === annotation.id} onclick={() => { selectedId = annotation.id; if (annotation.start) jump(annotation.start.round); }}>
                  <span class="kind">{annotation.kind}{annotation.start ? ` · r${annotation.start.round}` : ""}</span>
                  <b>{annotation.title}</b>
                  <span>{annotation.status}</span>
                </button>
              {/each}
            </div>

            {#if selected}
              <form class="editor" onsubmit={(event) => event.preventDefault()}>
                <div class="editor-head"><span>Edit annotation</span><button class="danger" onclick={removeSelected}>Delete</button></div>
                <label>Title<input bind:value={selected.title} oninput={() => touch(selected)} /></label>
                <div class="two">
                  <label>Status<select bind:value={selected.status} onchange={() => touch(selected)}><option>candidate</option><option>confirmed</option><option>needs-evidence</option><option>rejected</option></select></label>
                  <label>Confidence<input type="number" min="0" max="1" step="0.05" bind:value={selected.confidence} oninput={() => touch(selected)} /></label>
                </div>
                {#if selected.kind !== "general"}
                  <div class="round-row"><button onclick={() => selected.start && jump(selected.start.round)}>Start r{selected.start?.round}</button>{#if selected.kind === "range"}<button onclick={setRangeEnd}>Set end to r{runner.round}</button>{/if}</div>
                {/if}
                <label>Observed evidence<textarea rows="4" bind:value={selected.observation} oninput={() => touch(selected)} placeholder="What is directly visible in the replay?"></textarea></label>
                <label>Hypothesis<textarea rows="3" bind:value={selected.hypothesis} oninput={() => touch(selected)} placeholder="What strategy might explain it?"></textarea></label>
                <label>Alternatives<textarea rows="3" value={(selected.alternatives ?? []).join("\n")} oninput={(event) => { selected.alternatives = event.currentTarget.value.split("\n").filter(Boolean); touch(selected); }} placeholder="One competing explanation per line"></textarea></label>
                <label>Tags<input value={selected.tags.join(", ")} oninput={(event) => { selected.tags = event.currentTarget.value.split(",").map((x) => x.trim()).filter(Boolean); touch(selected); }} /></label>
                <button class:on={mapPick} onclick={() => (mapPick = !mapPick)}>{mapPick ? "Click cells on board (done)" : "Highlight map cells"}</button>
                {#if selected.steps?.length}
                  <details><summary>Sequence evidence <span>{selected.steps.length} steps</span></summary>{#each selected.steps as step}<button class="step" onclick={() => jump(step.anchor.round)}>r{step.anchor.round}: {step.label}</button>{/each}</details>
                {/if}
              </form>
            {/if}
          </section>
        {:else if tab === "log"}
          <section class="fill-panel"><GameLog match={loaded.match} {runner} teams={loaded.teams} /></section>
        {:else if tracker && stats}
          <section class="info-panel">
            <h2>{research.replay.mapName}</h2>
            <TeamStats teams={loaded.teams} {stats} />
            <MatchCharts {tracker} round={runner.round} colors={{ A: loaded.teams.A.color, B: loaded.teams.B.color }} />
            <p>{loaded.events.length.toLocaleString()} events · {loaded.match.maxRound} rounds · {candidates.length} sequence candidates</p>
          </section>
        {/if}
      </aside>

      <section class="viewer">
        <div class="board-shell">
          <BoardView match={loaded.match} {runner} mapSkin={defaultMapSkin()} dragonSkin={defaultDragonSkin()} maxCell={120} debugDragonIds={selected?.dragonIds}>
            {#snippet overlay(projection)}
              <div
                class="research-overlay"
                class:picking={mapPick}
                role="button"
                tabindex={mapPick ? 0 : -1}
                aria-label="Select highlighted map cells"
                onclick={(event) => boardClick(event, projection)}
                onkeydown={(event) => { if (event.key === "Escape") mapPick = false; }}
              >
                {#each highlightRects(selected) as highlight, index (`${highlight.kind}-${highlight.x}-${highlight.y}-${index}`)}
                  {@const at = projection.project(highlight.x, highlight.y)}
                  <div class="map-highlight" style:left="{at.x}px" style:top="{at.y}px" style:width="{highlight.width * projection.scale}px" style:height="{highlight.height * projection.scale}px" style:border-color={highlight.color ?? "#ffe066"} title={highlight.label}></div>
                {/each}
              </div>
            {/snippet}
          </BoardView>
        </div>
        <div class="research-track" aria-label="Research annotation timeline">
          {#each research.annotations.filter((item) => item.start) as annotation (annotation.id)}
            <button
              class:range={annotation.kind === "range" || annotation.kind === "sequence"}
              class:selected={selectedId === annotation.id}
              style:left="{((annotation.start?.round ?? 0) / Math.max(1, loaded.match.maxRound)) * 100}%"
              style:width="{Math.max(0.5, (((annotation.end?.round ?? annotation.start?.round ?? 0) - (annotation.start?.round ?? 0)) / Math.max(1, loaded.match.maxRound)) * 100)}%"
              title={annotation.title}
              onclick={() => { selectedId = annotation.id; jump(annotation.start!.round); }}
            ></button>
          {/each}
        </div>
        <PlaybackControls {runner} match={loaded.match} />
      </section>
    </div>
  </main>
{:else}
  <div class="message">Opening replay and research sidecar…</div>
{/if}

<style>
  .studio { height: 100%; display: flex; flex-direction: column; min-width: 0; }
  header { height: 48px; flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid var(--studio-border); background: var(--studio-panel); }
  header > div:first-child { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
  header span { color: var(--studio-muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .header-actions { display: flex; gap: 6px; }
  button { color: var(--studio-text); border: 1px solid var(--studio-border); border-radius: 4px; background: var(--studio-raised); padding: 5px 9px; }
  button:hover, button.on { border-color: var(--studio-accent); }
  button.quiet { background: transparent; }
  button.danger { color: var(--studio-danger); background: transparent; }
  .notice { border-radius: 0; border-width: 0 0 1px; text-align: left; color: var(--studio-text); background: color-mix(in srgb, var(--studio-accent) 18%, var(--studio-panel)); }
  .workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(285px, 360px) 1fr; }
  aside { min-height: 0; display: flex; flex-direction: column; border-right: 1px solid var(--studio-border); background: var(--studio-panel); }
  nav { display: flex; flex: 0 0 auto; border-bottom: 1px solid var(--studio-border); }
  nav button { flex: 1; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; }
  nav button.on { border-bottom-color: var(--studio-accent); }
  .research-panel, .fill-panel, .info-panel { flex: 1; min-height: 0; overflow: auto; padding: 10px; }
  .new-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px; }
  details { border: 1px solid var(--studio-border); border-radius: 4px; margin-bottom: 10px; }
  summary { padding: 7px; cursor: pointer; font-size: 12px; font-weight: 600; }
  summary span { float: right; color: var(--studio-muted); }
  .hint { margin: 0; padding: 0 8px 8px; color: var(--studio-muted); font-size: 11px; line-height: 1.35; }
  .candidate-list { max-height: 160px; overflow: auto; }
  .candidate-list button, .annotation-list button { display: flex; flex-direction: column; align-items: stretch; width: 100%; text-align: left; border-width: 1px 0 0; border-radius: 0; background: transparent; }
  .candidate-list span, .annotation-list span { color: var(--studio-muted); font: 10px var(--font-mono); overflow: hidden; text-overflow: ellipsis; }
  .annotation-list { margin-bottom: 10px; border: 1px solid var(--studio-border); border-radius: 4px; overflow: hidden; }
  .annotation-list button:first-child { border-top: 0; }
  .annotation-list button.on { background: color-mix(in srgb, var(--studio-accent) 13%, transparent); }
  .kind { text-transform: uppercase; letter-spacing: .08em; }
  .editor { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--studio-border); }
  .editor-head { display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
  label { display: flex; flex-direction: column; gap: 3px; color: var(--studio-muted); font-size: 11px; }
  input, textarea, select { width: 100%; color: var(--studio-text); border: 1px solid var(--studio-border); border-radius: 3px; background: var(--studio-bg); padding: 6px; resize: vertical; }
  input:focus, textarea:focus, select:focus { outline: 1px solid var(--studio-accent); }
  .two { display: grid; grid-template-columns: 1fr 90px; gap: 6px; }
  .round-row { display: flex; gap: 5px; }
  .step { display: block; width: 100%; border-width: 1px 0 0; border-radius: 0; text-align: left; font-size: 11px; background: transparent; }
  .info-panel h2 { margin: 4px 0 14px; }
  .info-panel p { color: var(--studio-muted); font-size: 12px; }
  .viewer { min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 10px; gap: 6px; }
  .board-shell { flex: 1; min-height: 0; display: flex; overflow: hidden; border: 1px solid var(--studio-border); border-radius: 5px; }
  .research-overlay { position: absolute; inset: 0; pointer-events: none; }
  .research-overlay.picking { pointer-events: auto; cursor: crosshair; }
  .map-highlight { position: absolute; border: 3px solid #ffe066; background: color-mix(in srgb, #ffe066 24%, transparent); pointer-events: none; }
  .research-track { position: relative; height: 12px; margin: 0 9px; background: var(--studio-raised); border-radius: 6px; overflow: hidden; }
  .research-track button { position: absolute; top: 1px; height: 10px; min-width: 5px; padding: 0; border: 0; border-radius: 5px; background: #ffe066; }
  .research-track button.range { background: #56d4c6; opacity: .8; }
  .research-track button.selected { box-shadow: 0 0 0 2px white inset; opacity: 1; }
  .message { margin: 30px; display: flex; flex-direction: column; gap: 8px; }
  .message.error { color: var(--studio-danger); }
  @media (max-width: 800px) { .workspace { grid-template-columns: 280px 1fr; } header span { display: none; } }
</style>
