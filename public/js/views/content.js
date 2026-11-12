/** 自媒体：选题管线（5 阶段看板）+ 发布记录 + 发布后数据可视化。 */
import { CONTENT_STAGES, PLATFORMS, uid } from '../core/model.js';
import { contentStats, postMetrics } from '../core/stats.js';
import { mdCN, todayISO, formatCN } from '../core/dates.js';
import {
  esc,
  icon,
  badge,
  emptyState,
  openModal,
  field,
  formGrid,
  readForm,
  confirmDialog,
  tabs,
  fmtCompact,
  fmtNum,
  statBlock,
} from '../components/ui.js';
import { lineChart, barChart, sparkline, donut, CHART_COLORS } from '../components/charts.js';
import { addToToday, isInToday } from './_helpers.js';

let tab = 'pipeline';
let platformFilter = 'all';
let range = 30;

function upsertTodaySnapshot(post, metrics) {
  const day = todayISO();
  const hasValue = ['views', 'likes', 'comments', 'followers'].some((k) => Number(metrics[k]) > 0);
  if (!hasValue) return;
  const idx = (post.snapshots || []).findIndex((s) => s.date === day);
  const snap = {
    date: day,
    views: Number(metrics.views) || 0,
    likes: Number(metrics.likes) || 0,
    comments: Number(metrics.comments) || 0,
    followers: Number(metrics.followers) || 0,
  };
  if (idx >= 0) post.snapshots[idx] = snap;
  else post.snapshots.push(snap);
  post.snapshots.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function openIdeaModal(idea, ctx, presetStage = 'idea') {
  const isEdit = !!idea;
  const d = idea || { title: '', angle: '', platform: state0(ctx).settings.contentPlatformDefault || PLATFORMS[0], stage: presetStage, tags: [], note: '' };
  openModal({
    title: isEdit ? '编辑选题' : '新建选题',
    subtitle: '从一句想法开始，慢慢长成一条作品',
    body: formGrid(
      field({ label: '选题 / 标题', name: 'title', value: d.title, placeholder: '比如：一个人做完整套个人系统是什么体验', required: true, span: 2 }) +
        field({ label: '切入角度', name: 'angle', type: 'textarea', value: d.angle || '', placeholder: '想讲什么、给谁看、钩子是什么', span: 2, rows: 2 }) +
        field({ label: '目标平台', name: 'platform', value: d.platform, options: state0(ctx).content.platforms }) +
        field({
          label: '当前阶段',
          name: 'stage',
          value: d.stage || 'idea',
          options: CONTENT_STAGES.map((s) => ({ value: s.key, label: s.label })),
        }) +
        field({
          label: '标签',
          name: 'tags',
          value: (d.tags || []).join(', '),
          placeholder: '用逗号分隔，例如：效率, 复盘',
          span: 2,
        }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">${isEdit ? '保存' : '加入选题库'}</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        if (!raw.title) return node.querySelector('[name="title"]').focus();
        const data = {
          ...raw,
          tags: String(raw.tags || '')
            .split(/[,，\s]+/)
            .map((t) => t.trim())
            .filter(Boolean),
        };
        ctx.update((st) => {
          if (isEdit) Object.assign(st.content.ideas.find((x) => x.id === idea.id), data);
          else
            st.content.ideas.unshift({
              id: uid('idea'),
              ...data,
              createdAt: new Date().toISOString(),
            });
        });
        close();
        ctx.toast(isEdit ? '选题已更新' : '已加入选题库');
      });
    },
  });
}

function state0(ctx) {
  return ctx.state;
}

function openPostModal(post, ctx, preset = {}) {
  const isEdit = !!post;
  const latest = post ? postMetrics(post) : { views: '', likes: '', comments: '', followers: '' };
  const d = post || {
    title: preset.title || '',
    platform: preset.platform || state0(ctx).content.platformDefault || PLATFORMS[0],
    publishedAt: todayISO(),
    url: '',
    note: '',
    ideaId: preset.ideaId || '',
  };
  openModal({
    title: isEdit ? '更新作品数据' : '记录一条发布',
    subtitle: '填今天的累计数据，会自动生成一条快照，用来画增长曲线',
    size: 'lg',
    body:
      formGrid(
        field({ label: '作品标题', name: 'title', value: d.title, required: true, span: 2 }) +
          field({ label: '平台', name: 'platform', value: d.platform, options: state0(ctx).content.platforms }) +
          field({ label: '发布日期', name: 'publishedAt', type: 'date', value: d.publishedAt }) +
          field({ label: '链接（可不填）', name: 'url', value: d.url || '', placeholder: 'https://…', span: 2 }) +
          field({ label: '备注', name: 'note', value: d.note || '', placeholder: '投放、选题复盘、评论反馈…', span: 2, rows: 2 }),
        2
      ) +
      `<div class="divider"></div>
       <div class="tiny muted" style="margin-bottom:8px">当前累计数据（留空表示这次不更新）</div>
       ${formGrid(
         field({ label: '播放量', name: 'views', type: 'number', min: 0, value: latest.views === 0 ? '' : latest.views, placeholder: '0' }) +
           field({ label: '点赞', name: 'likes', type: 'number', min: 0, value: latest.likes === 0 ? '' : latest.likes, placeholder: '0' }) +
           field({ label: '评论', name: 'comments', type: 'number', min: 0, value: latest.comments === 0 ? '' : latest.comments, placeholder: '0' }) +
           field({ label: '涨粉', name: 'followers', type: 'number', min: 0, value: latest.followers === 0 ? '' : latest.followers, placeholder: '0' }),
         4
       )}`,
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">${isEdit ? '保存并记录快照' : '记录发布'}</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        if (!raw.title) return node.querySelector('[name="title"]').focus();
        const metrics = {
          views: raw.views,
          likes: raw.likes,
          comments: raw.comments,
          followers: raw.followers,
        };
        ctx.update((st) => {
          if (isEdit) {
            const target = st.content.posts.find((x) => x.id === post.id);
            target.title = raw.title;
            target.platform = raw.platform;
            target.publishedAt = raw.publishedAt;
            target.url = raw.url;
            target.note = raw.note;
            target.snapshots = target.snapshots || [];
            upsertTodaySnapshot(target, metrics);
          } else {
            const created = {
              id: uid('post'),
              title: raw.title,
              platform: raw.platform,
              publishedAt: raw.publishedAt || todayISO(),
              url: raw.url,
              note: raw.note,
              ideaId: d.ideaId || '',
              snapshots: [],
              createdAt: new Date().toISOString(),
            };
            upsertTodaySnapshot(created, metrics);
            st.content.posts.unshift(created);
            if (d.ideaId) {
              const idea = st.content.ideas.find((i) => i.id === d.ideaId);
              if (idea) idea.stage = 'published';
            }
          }
        });
        close();
        ctx.toast(isEdit ? '数据已更新，并生成今日快照' : '发布记录已保存');
      });
    },
  });
}

export default {
  render(state, ctx, opts = {}) {
    const activeTab = opts.tab || tab;
    const stats = contentStats(state, range, ctx.today);
    const ideas = [...state.content.ideas].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const posts = [...state.content.posts].sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
    const filteredPosts = platformFilter === 'all' ? posts : posts.filter((p) => p.platform === platformFilter);
    const totalIdeas = ideas.length;

    const header = `<div class="toolbar">
      ${tabs({
        name: 'content',
        active: activeTab,
        items: [
          { key: 'pipeline', label: '选题管线', count: totalIdeas },
          { key: 'data', label: '发布数据', count: state.content.posts.length },
        ],
      })}
      <span class="spacer"></span>
      <button class="btn btn-ghost" type="button" data-act="new-idea">${icon('plus', 14)}新建选题</button>
      <button class="btn btn-primary" type="button" data-act="new-post">${icon('video', 14)}记录发布</button>
    </div>`;

    if (activeTab === 'pipeline') {
      return `${header}
      <div class="hint-box accent" style="margin-bottom:14px">${icon('spark', 15)}
        <span>把想法放进「选题」，点卡片可修改内容；点卡片右下角的箭头推进到下一阶段，推进到「已发布」时直接记录数据。</span>
      </div>
      <div class="kanban">
        ${CONTENT_STAGES.map((stage) => {
          const items = ideas.filter((i) => (i.stage || 'idea') === stage.key);
          return `<div class="kanban-col" data-stage="${stage.key}">
            <div class="kanban-head"><b>${stage.label}</b><span class="kanban-count">${items.length}</span></div>
            ${items
              .map(
                (idea) => `<button class="kanban-item" type="button" data-idea="${esc(idea.id)}">
                  <span class="k-title">${esc(idea.title)}</span>
                  <span class="k-meta">
                    ${idea.platform ? badge(idea.platform, 'neutral') : ''}
                    ${(idea.tags || []).slice(0, 2).map((t) => `<span class="tiny muted">#${esc(t)}</span>`).join(' ')}
                    <span class="spacer"></span>
                    <span class="kanban-advance" data-advance="${esc(idea.id)}" title="推进到下一阶段">→</span>
                  </span>
                </button>`
              )
              .join('')}
            ${items.length === 0 ? `<div class="kanban-empty">空着</div>` : ''}
            <button class="kanban-add" type="button" data-new-idea="${stage.key}">+ 加一条</button>
          </div>`;
        }).join('')}
      </div>
      ${
        totalIdeas === 0
          ? `<div class="mt-16">${emptyState({
              iconName: 'video',
              title: '选题库还是空的',
              text: '先写三条你最近想拍/想写的东西，不用完整，一句话就够。',
              action: `<button class="btn btn-primary btn-sm" type="button" data-act="new-idea">${icon('plus', 13)}新建第一条选题</button>`,
            })}</div>`
          : ''
      }`;
    }

    const kpis = `<div class="kpi-grid" style="margin-bottom:16px">
      ${statBlock({ label: '总播放', value: fmtCompact(stats.totalViews), foot: `${stats.postCount} 条作品` })}
      ${statBlock({ label: '总互动', value: fmtCompact(stats.totalInteractions), foot: `互动率 ${stats.engagementRate}%` })}
      ${statBlock({ label: '累计涨粉', value: fmtCompact(stats.totalFollowers), foot: `平均播放 ${fmtCompact(stats.avgViews)}` })}
      ${statBlock({
        label: `近 ${range} 天播放增量`,
        value: fmtCompact(stats.series.length ? stats.series[stats.series.length - 1].views - stats.series[0].views : 0),
        foot: `更新至 ${mdCN(ctx.today)}`,
      })}
    </div>`;

    return `${header}
    ${kpis}
    <div class="split-main">
      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div><div class="card-title">${icon('video', 15)}播放量增长</div><div class="card-sub">按作品累计播放汇总，越靠后越多说明还在涨</div></div>
            <div class="card-actions">
              <select class="inline-select" data-range>
                <option value="7" ${range === 7 ? 'selected' : ''}>近 7 天</option>
                <option value="30" ${range === 30 ? 'selected' : ''}>近 30 天</option>
                <option value="90" ${range === 90 ? 'selected' : ''}>近 90 天</option>
              </select>
            </div>
          </div>
          <div class="card-body">${lineChart({
            labels: stats.series.map((s) => mdCN(s.date)),
            series: [{ name: '播放', values: stats.series.map((s) => s.views), color: CHART_COLORS[0] }],
            height: 220,
          })}</div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><div class="card-title">${icon('target', 15)}作品表现</div><div class="card-sub">按累计播放排序，点「更新数据」补录</div></div>
          </div>
          <div class="card-body tight">
            ${
              filteredPosts.length
                ? `<div class="table-wrap"><table class="table">
                  <thead><tr><th>作品</th><th>平台</th><th class="num-cell">播放</th><th class="num-cell">点赞</th><th class="num-cell">涨粉</th><th>数据日期</th><th></th></tr></thead>
                  <tbody>
                    ${filteredPosts
                      .map((p) => {
                        const m = postMetrics(p);
                        return `<tr>
                          <td><div class="truncate" style="max-width:26ch" title="${esc(p.title)}">${esc(p.title)}</div>
                            <div class="tiny muted">${formatCN(p.publishedAt)} 发布</div></td>
                          <td>${badge(p.platform || '—', 'neutral')}</td>
                          <td class="num-cell">${fmtCompact(m.views)}</td>
                          <td class="num-cell">${fmtNum(m.likes)}</td>
                          <td class="num-cell">${fmtNum(m.followers)}</td>
                          <td class="tiny muted">${m.snapDate ? mdCN(m.snapDate) : '未录'}</td>
                          <td><div class="actions">
                            <button class="btn btn-ghost btn-sm" type="button" data-edit-post="${esc(p.id)}">更新数据</button>
                            <button class="btn btn-icon" type="button" data-del-post="${esc(p.id)}" title="删除">${icon('trash', 13)}</button>
                          </div></td>
                        </tr>`;
                      })
                      .join('')}
                  </tbody></table></div>`
                : emptyState({
                    iconName: 'video',
                    title: '还没有发布记录',
                    text: '发出去之后回来记一笔，数据才会积累成曲线。',
                    action: `<button class="btn btn-primary btn-sm" type="button" data-act="new-post">${icon('plus', 13)}记录第一条</button>`,
                  })
            }
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('target', 15)}平台对比</div><div class="card-sub">播放量越高，越值得继续投</div></div></div>
          <div class="card-body">${
            stats.platformTotals.length
              ? barChart({
                  labels: stats.platformTotals.map((p) => p.platform),
                  values: stats.platformTotals.map((p) => p.views),
                  horizontal: true,
                  color: CHART_COLORS,
                  width: 340,
                  height: 150,
                })
              : `<p class="tiny muted">还没有数据。</p>`
          }</div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('users', 15)}粉丝增长</div><div class="card-sub">累计涨粉走势</div></div></div>
          <div class="card-body">${lineChart({
            labels: stats.series.map((s) => mdCN(s.date)),
            series: [{ name: '涨粉', values: stats.series.map((s) => s.followers), color: CHART_COLORS[1] }],
            height: 170,
            width: 380,
          })}</div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('spark', 15)}平台分布</div><div class="card-sub">按作品数</div></div></div>
          <div class="card-body">${donut({
            items: stats.platformTotals.map((p) => ({ label: p.platform, value: p.count })),
            size: 132,
            centerValue: String(stats.postCount),
            centerLabel: '条作品',
          })}</div>
        </section>
      </div>
    </div>`;
  },

  bind(root, ctx) {
    root.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-tab-key]');
      if (tabBtn) {
        tab = tabBtn.dataset.tabKey;
        ctx.rerender();
        return;
      }

      if (e.target.closest('[data-act="new-idea"]')) {
        openIdeaModal(null, ctx, 'idea');
        return;
      }
      const newIdea = e.target.closest('[data-new-idea]');
      if (newIdea) {
        openIdeaModal(null, ctx, newIdea.dataset.newIdea);
        return;
      }

      const advance = e.target.closest('[data-advance]');
      if (advance) {
        e.stopPropagation();
        const idea = ctx.state.content.ideas.find((x) => x.id === advance.dataset.advance);
        if (!idea) return;
        const idx = CONTENT_STAGES.findIndex((s) => s.key === (idea.stage || 'idea'));
        const next = CONTENT_STAGES[idx + 1];
        if (!next) {
          ctx.toast('已经是最后一个阶段了', 'warn');
          return;
        }
        if (next.key === 'published') {
          openPostModal(null, ctx, { title: idea.title, platform: idea.platform, ideaId: idea.id });
          return;
        }
        ctx.update((st) => {
          st.content.ideas.find((x) => x.id === idea.id).stage = next.key;
        });
        ctx.toast(`已推进到「${next.label}」`);
        return;
      }

      const ideaBtn = e.target.closest('[data-idea]');
      if (ideaBtn) {
        const idea = ctx.state.content.ideas.find((x) => x.id === ideaBtn.dataset.idea);
        if (idea) openIdeaModal(idea, ctx);
        return;
      }

      if (e.target.closest('[data-act="new-post"]')) {
        openPostModal(null, ctx);
        return;
      }
      const editPost = e.target.closest('[data-edit-post]');
      if (editPost) {
        const post = ctx.state.content.posts.find((p) => p.id === editPost.dataset.editPost);
        if (post) openPostModal(post, ctx);
        return;
      }
      const delPost = e.target.closest('[data-del-post]');
      if (delPost) {
        const post = ctx.state.content.posts.find((p) => p.id === delPost.dataset.delPost);
        confirmDialog({
          title: '删除这条发布记录？',
          message: `「${post?.title || ''}」的发布记录与所有数据快照都会被删除，无法恢复。`,
          confirmText: '删除',
          danger: true,
        }).then((ok) => {
          if (!ok) return;
          ctx.update((st) => {
            st.content.posts = st.content.posts.filter((p) => p.id !== delPost.dataset.delPost);
          });
          ctx.toast('已删除');
        });
      }
    });

    root.addEventListener('change', (e) => {
      if (e.target.matches('[data-range]')) {
        range = Number(e.target.value);
        ctx.rerender();
      }
      if (e.target.matches('[data-platform-filter]')) {
        platformFilter = e.target.value;
        ctx.rerender();
      }
    });
  },
};
