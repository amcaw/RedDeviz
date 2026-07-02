<script lang="ts">
  let { videoId, title, onclose }: { videoId: string; title: string; onclose: () => void } =
    $props();

  let playing = $state(false);
  $effect(() => {
    void videoId;
    playing = false;
  });
</script>

<div class="video-card">
  <button class="close" onclick={onclose} aria-label="Fermer">×</button>
  <p class="title">{title}</p>
  <div class="frame">
    {#if playing}
      <iframe
        src="https://www.youtube-nocookie.com/embed/{videoId}?autoplay=1&rel=0"
        title={title}
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      ></iframe>
    {:else}
      <button class="poster" onclick={() => (playing = true)} aria-label="Lire la vidéo">
        <img src="https://i.ytimg.com/vi/{videoId}/hqdefault.jpg" alt="" loading="lazy" />
        <span class="play" aria-hidden="true">
          <svg viewBox="0 0 68 48" width="68" height="48">
            <path
              d="M66.5 7.7c-.8-2.9-3-5.2-5.9-6C55.4.3 34 .3 34 .3s-21.4 0-26.6 1.4c-2.9.8-5.1 3.1-5.9 6C.3 13 .3 24 .3 24s0 11 1.2 16.3c.8 2.9 3 5.2 5.9 6C12.6 47.7 34 47.7 34 47.7s21.4 0 26.6-1.4c-2.9-.8 5.1-3.1 5.9-6C67.7 35 67.7 24 67.7 24s0-11-1.2-16.3z"
              fill="#f00"
            />
            <path d="M45 24 27 14v20z" fill="#fff" />
          </svg>
        </span>
      </button>
    {/if}
  </div>
  <p class="credit">Résumé vidéo — RTBF Sport (YouTube)</p>
</div>

<style>
  .video-card {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 16px 20px 12px;
    color: var(--text);
    font-family: var(--font);
  }
  .close {
    position: absolute;
    top: 8px;
    right: 14px;
    border: none;
    background: none;
    font-size: 26px;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
    z-index: 2;
  }
  .close:hover {
    color: var(--text);
  }
  .title {
    margin: 0 32px 10px 0;
    font-size: 13.5px;
    font-weight: 600;
  }
  .frame {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    border-radius: 10px;
    overflow: hidden;
  }
  .frame iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .poster {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    padding: 0;
    background: #000;
    cursor: pointer;
  }
  .poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.85;
    transition: opacity 0.15s;
  }
  .poster:hover img {
    opacity: 1;
  }
  .play {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
    transition: transform 0.15s;
  }
  .poster:hover .play {
    transform: translate(-50%, -50%) scale(1.08);
  }
  .credit {
    margin: 8px 0 0;
    font-size: 10.5px;
    color: var(--text-muted);
    text-align: right;
  }
</style>
