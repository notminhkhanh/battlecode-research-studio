<script lang="ts">
  import { onMount } from "svelte";
  import {
    GameRunner,
    ReplayInspector,
    buildReplay,
    type LoadedReplay,
  } from "@battledragon/visualiser";
  import {
    newAnnotation,
    newResearchDocument,
    parseResearchDocument,
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
  let fileName = $state("");
  let bookmarkPath = $state("");
  let replayHash = $state("");
  let errorMessage: string | undefined = $state();
  let notice = $state("");

  const selected = $derived(research?.annotations.find((item) => item.id === selectedId));

  function touch(annotation?: ResearchAnnotation) {
    if (!research) return;
    const now = new Date().toISOString();
    research.updatedAt = now;
    if (annotation) annotation.provenance.updatedAt = now;
  }

  function add(kind: "general" | "point" | "range") {
    if (!research || !runner) return;
    const annotation = newAnnotation(kind, "VS Code user", { round: runner.round });
    annotation.dragonIds = [...new Set(runner.selectedDragonIds)];
    research.annotations.push(annotation);
    selectAnnotation(annotation, false);
    touch(annotation);
  }

  function addCandidate(candidate: SequenceCandidate) {
    if (!research) return;
    const existing = research.annotations.find((item) => item.id === candidate.id);
    if (existing) {
      selectAnnotation(existing);
      return;
    }
    const annotation = sequenceCandidateToAnnotation(candidate);
    research.annotations.push(annotation);
    selectAnnotation(annotation);
    touch(annotation);
  }

  function removeSelected() {
    if (!research || !selectedId) return;
    research.annotations = research.annotations.filter((item) => item.id !== selectedId);
    clearAnnotationSelection();
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

  function focusDragons(ids: number[] = selected?.dragonIds ?? []) {
    if (!runner) return;
    runner.selectedDragonIds = [...new Set(ids)];
  }

  function clearAnnotationSelection() {
    selectedId = undefined;
    focusDragons([]);
  }

  function selectAnnotation(annotation: ResearchAnnotation, seek = true) {
    selectedId = annotation.id;
    focusDragons(annotation.dragonIds ?? []);
    if (seek && annotation.start) jump(annotation.start.round);
  }

  function captureSelectedDragons() {
    if (!selected || !runner) return;
    selected.dragonIds = [...new Set(runner.selectedDragonIds)];
    touch(selected);
  }

  async function sha256(bytes: Uint8Array): Promise<string> {
    const copy = Uint8Array.from(bytes).buffer;
    const digest = await crypto.subtle.digest("SHA-256", copy);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function open(bytes: Uint8Array, name: string, researchText?: string, researchPath?: string) {
    try {
      notice = "";
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
      replayHash = identity.sha256;
      bookmarkPath = researchPath ?? "";
      research = researchText ? parseResearchDocument(researchText) : newResearchDocument(identity);
      if (research.replay.sha256 !== identity.sha256) {
        notice = "Warning: this sidecar was created for different replay bytes. Review it before saving.";
      }
      candidates = detectSequenceCandidates(loaded);
      clearAnnotationSelection();
      errorMessage = undefined;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function save(saveAs = false) {
    if (!research) return;
    touch(selected);
    // Svelte's deep state is a Proxy, which VS Code's real message bridge
    // cannot structured-clone. Serialize once to send an ordinary object.
    const document = JSON.parse(JSON.stringify(research)) as ResearchDocument;
    api.postMessage({ type: saveAs ? "saveAs" : "save", document });
  }

  function openBookmark() {
    api.postMessage({ type: "openResearch" });
  }

  onMount(() => {
    const receive = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === "open") {
        if (message.replayUrl) {
          void fetch(message.replayUrl)
            .then((response) => response.arrayBuffer())
            .then((bytes) => open(new Uint8Array(bytes), message.name, message.researchText, message.researchPath))
            .catch((error) => (errorMessage = error instanceof Error ? error.message : String(error)));
        } else {
          void open(new Uint8Array(message.replayBytes), message.name, message.researchText, message.researchPath);
        }
      }
      else if (message?.type === "error" || message?.type === "save-error") errorMessage = message.message;
      else if (message?.type === "research-error") notice = message.message;
      else if (message?.type === "research-loaded") {
        try {
          const incoming = parseResearchDocument(message.researchText);
          research = incoming;
          clearAnnotationSelection();
          bookmarkPath = message.path;
          notice = incoming.replay.sha256 === replayHash
            ? `Opened bookmark file ${message.path}`
            : `Opened ${message.path}; verify that it belongs to this replay.`;
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
        }
      }
      else if (message?.type === "saved") {
        bookmarkPath = message.path;
        notice = `Saved ${message.path}`;
      }
    };
    window.addEventListener("message", receive);
    api.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", receive);
  });
</script>

{#if errorMessage}
  <div class="message error"><strong>Could not open research studio</strong><span>{errorMessage}</span></div>
{:else if loaded && runner && research}
  {#snippet researchPanel()}
    <div class="research-panel">
      <div class="research-file-actions">
        <button onclick={openBookmark}>Open bookmark file…</button>
        <button onclick={() => save(false)}>Save</button>
        <button onclick={() => save(true)}>Save as…</button>
      </div>
      {#if bookmarkPath}<p class="bookmark-path" title={bookmarkPath}>{bookmarkPath}</p>{/if}
      {#if notice}<button class="notice" onclick={() => (notice = "")}>{notice}</button>{/if}

      <div class="new-buttons">
        <button onclick={() => add("point")}>+ Point</button>
        <button onclick={() => add("range")}>+ Range</button>
        <button onclick={() => add("general")}>+ General</button>
      </div>

      <details open={research!.annotations.length === 0}>
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
        {#each research!.annotations as annotation (annotation.id)}
          <button class:on={selectedId === annotation.id} onclick={() => selectAnnotation(annotation)}>
            <span class="kind">{annotation.kind}{annotation.start ? ` · r${annotation.start.round}` : ""}</span>
            <b>{annotation.title}</b>
            <span>{annotation.status}</span>
          </button>
        {/each}
      </div>

      <section class="annotation-detail" aria-label="Annotation details">
        {#if selected}
          <form class="editor" onsubmit={(event) => event.preventDefault()}>
          <div class="editor-head"><span>Edit annotation</span><button class="danger" onclick={removeSelected}>Delete</button></div>
          <label>Title<input bind:value={selected.title} oninput={() => touch(selected)} /></label>
          <div class="two">
            <label>Status<select bind:value={selected.status} onchange={() => touch(selected)}><option>candidate</option><option>confirmed</option><option>needs-evidence</option><option>rejected</option></select></label>
            <label>Confidence<input type="number" min="0" max="1" step="0.05" bind:value={selected.confidence} oninput={() => touch(selected)} /></label>
          </div>
          {#if selected.kind !== "general"}
            <div class="round-row"><button onclick={() => selected.start && jump(selected.start.round)}>Start r{selected.start?.round}</button>{#if selected.kind === "range"}<button onclick={setRangeEnd}>Set end to r{runner!.round}</button>{/if}</div>
          {/if}
          <label>Referenced dragon IDs<input value={(selected.dragonIds ?? []).join(", ")} oninput={(event) => { selected.dragonIds = event.currentTarget.value.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 0); focusDragons(selected.dragonIds); touch(selected); }} placeholder="For example: 27, 34" /></label>
          <div class="dragon-actions">
            <button onclick={captureSelectedDragons}>Use currently selected dragons</button>
            <button onclick={() => focusDragons([])}>Clear viewer selection</button>
          </div>
          <label>Observed evidence<textarea rows="4" bind:value={selected.observation} oninput={() => touch(selected)} placeholder="What is directly visible in the replay?"></textarea></label>
          <label>Hypothesis<textarea rows="3" bind:value={selected.hypothesis} oninput={() => touch(selected)} placeholder="What strategy might explain it?"></textarea></label>
          <label>Alternatives<textarea rows="3" value={(selected.alternatives ?? []).join("\n")} oninput={(event) => { selected.alternatives = event.currentTarget.value.split("\n").filter(Boolean); touch(selected); }} placeholder="One competing explanation per line"></textarea></label>
          {#if selected.steps?.length}
            <details><summary>Sequence evidence <span>{selected.steps.length} steps</span></summary>{#each selected.steps as step}<button class="step" onclick={() => { focusDragons(step.dragonIds ?? []); jump(step.anchor.round); }}>r{step.anchor.round}: {step.label}</button>{/each}</details>
          {/if}
          </form>
        {/if}
      </section>
    </div>
  {/snippet}

  <!-- Match the original UNSWBC VS Code host; Research is only an extra inspector tab. -->
  <div class="frame">
    <ReplayInspector {loaded} {runner} file={fileName} {researchPanel} />
  </div>
{:else}
  <div class="message">Opening replay and research sidecar…</div>
{/if}

<style>
  .frame { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: .75rem; overflow: auto; }
  button { color: var(--vis-ink-2); border: 1px solid var(--vis-rule); border-radius: var(--vis-radius-field); background: var(--vis-base-300); padding: .3rem .5rem; font-family: inherit; font-size: calc(var(--vis-text-meta) * var(--font-scale, 1)); line-height: 1.25; cursor: pointer; }
  button:hover { color: var(--vis-ink); }
  button.on { color: var(--vis-ink); border-color: currentColor; }
  button.danger { color: var(--vis-error); background: transparent; }
  .research-panel { min-height: 0; padding: .75rem; font-size: calc(var(--vis-text-meta) * var(--font-scale, 1)); }
  .research-file-actions { display: grid; grid-template-columns: 1fr auto auto; gap: 5px; margin-bottom: 5px; }
  .bookmark-path { margin: 0 0 7px; color: var(--vis-ink-3); font: var(--vis-text-label) var(--vis-font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .notice { display: block; width: 100%; margin-bottom: 7px; text-align: left; color: var(--vis-primary); background: var(--vis-base-300); }
  .new-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px; }
  details { border: 1px solid var(--vis-rule); border-radius: var(--vis-radius-box); margin-bottom: 10px; }
  summary { padding: 7px; cursor: pointer; font-size: calc(var(--vis-text-meta) * var(--font-scale, 1)); font-weight: 600; }
  summary span { float: right; color: var(--vis-ink-3); }
  .hint { margin: 0; padding: 0 8px 8px; color: var(--vis-ink-3); font-size: var(--vis-text-label); line-height: 1.35; }
  .candidate-list { max-height: 160px; overflow: auto; }
  .candidate-list button, .annotation-list button { display: flex; flex-direction: column; align-items: stretch; width: 100%; text-align: left; border-width: 1px 0 0; border-radius: 0; background: transparent; }
  .candidate-list span, .annotation-list span { color: var(--vis-ink-3); font: var(--vis-text-label) var(--vis-font-mono); overflow: hidden; text-overflow: ellipsis; }
  .annotation-list { height: 15rem; flex: 0 0 15rem; margin-bottom: 10px; border: 1px solid var(--vis-rule); border-radius: var(--vis-radius-box); overflow-x: hidden; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--vis-rule) transparent; }
  .annotation-list button:first-child { border-top: 0; }
  .annotation-list button.on { color: var(--vis-ink); border-left: 2px solid var(--vis-primary); background: var(--vis-press); }
  .kind { text-transform: uppercase; letter-spacing: .08em; }
  .annotation-detail { min-height: 8rem; padding-top: 10px; border-top: 1px solid var(--vis-rule); }
  .editor { display: flex; flex-direction: column; gap: 8px; }
  .editor-head { display: flex; justify-content: space-between; align-items: center; color: var(--vis-ink); font-size: calc(var(--vis-text-body) * var(--font-scale, 1)); font-weight: 600; }
  label { display: flex; flex-direction: column; gap: 3px; color: var(--vis-ink-3); font-size: var(--vis-text-label); }
  input, textarea, select { width: 100%; color: var(--vis-ink); border: 1px solid var(--vis-rule); border-radius: var(--vis-radius-field); background: var(--vis-field); padding: .35rem .45rem; font-size: calc(var(--vis-text-meta) * var(--font-scale, 1)); line-height: 1.35; resize: vertical; }
  input:focus, textarea:focus, select:focus { outline: 1px solid var(--vis-primary); }
  .two { display: grid; grid-template-columns: 1fr 90px; gap: 6px; }
  .round-row { display: flex; gap: 5px; }
  .dragon-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .step { display: block; width: 100%; border-width: 1px 0 0; border-radius: 0; text-align: left; font-size: 11px; background: transparent; }
  .message { margin: 30px; display: flex; flex-direction: column; gap: 8px; }
  .message.error { color: var(--vis-error); }
</style>
