export const SPA_JS = `
        // Supabase client
        const SUPABASE_URL = 'https://cuajqykpktquwqijzrfc.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YWpxeWtwa3RxdXdxaWp6cmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzMzOTUsImV4cCI6MjA4NTkwOTM5NX0.tQw_4wpcjN_tvBiXVSwBvq5HoXqn51ES-t9GNexchzk';
        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const CURRENT_USER_ID = window.__CLERK_USER_ID__;

        // State
        let documents = [];
        let currentCategory = 'all';
        let currentView = 'grid';
        let calendarDate = new Date();
        let currentViewDocId = null;
        let currentImages = []; // For attached images
        let currentInlineImages = {}; // For inline pasted images {marker: imageData}
        let inlineImageCounter = 0;
        let lightboxImages = [];
        let lightboxIndex = 0;
        let confirmCallback = null; // For custom confirm dialog
        let focusTrapElements = []; // For modal focus trap

        // ===== UX Enhancement: Loading Overlay =====
        function showLoading(message = '처리 중...') {
            const overlay = document.getElementById('loadingOverlay');
            const text = document.getElementById('loadingText');
            text.textContent = message;
            overlay.classList.add('active');
        }

        function hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            overlay.classList.remove('active');
        }

        // ===== UX Enhancement: Custom Confirm Dialog =====
        function customConfirm(message, title = '확인') {
            return new Promise((resolve) => {
                const dialog = document.getElementById('confirmDialog');
                const titleEl = document.getElementById('confirmTitle');
                const messageEl = document.getElementById('confirmMessage');
                const okBtn = document.getElementById('confirmOkBtn');
                const cancelBtn = document.getElementById('confirmCancelBtn');

                titleEl.textContent = title;
                messageEl.textContent = message;
                dialog.classList.add('active');

                // Focus on cancel button initially (safer default)
                cancelBtn.focus();

                // Setup focus trap
                setupFocusTrap(dialog);

                const cleanup = () => {
                    dialog.classList.remove('active');
                    okBtn.onclick = null;
                    cancelBtn.onclick = null;
                    document.removeEventListener('keydown', escapeHandler);
                };

                const escapeHandler = (e) => {
                    if (e.key === 'Escape') {
                        cleanup();
                        resolve(false);
                    }
                };

                okBtn.onclick = () => {
                    cleanup();
                    resolve(true);
                };

                cancelBtn.onclick = () => {
                    cleanup();
                    resolve(false);
                };

                document.addEventListener('keydown', escapeHandler);
            });
        }

        // ===== UX Enhancement: Focus Trap for Modals =====
        function setupFocusTrap(modalElement) {
            const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
            const focusableElements = modalElement.querySelectorAll(focusableSelectors);
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];

            const trapFocus = (e) => {
                if (e.key !== 'Tab') return;

                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable.focus();
                    }
                }
            };

            modalElement.addEventListener('keydown', trapFocus);
        }

        // ===== UX Enhancement: Search Highlight in Cards =====
        function highlightText(text, searchTerm) {
            if (!searchTerm) return escapeHtml(text);

            const escapedText = escapeHtml(text);
            const escapedTerm = escapeHtml(searchTerm);
            const regex = new RegExp(\`(\${escapedTerm})\`, 'gi');

            return escapedText.replace(regex, '<span class="search-highlight">\$1</span>');
        }

        // ===== UX Enhancement: Improved Empty State =====
        function renderEmptyState(type = 'default') {
            const messages = {
                default: {
                    icon: '📄',
                    title: '문서가 없습니다',
                    description: '새 문서를 작성하여 시작해보세요.',
                    showAction: true
                },
                search: {
                    icon: '🔍',
                    title: '검색 결과가 없습니다',
                    description: '다른 검색어를 입력하거나 필터를 조정해보세요.',
                    showAction: false
                },
                filter: {
                    icon: '📅',
                    title: '필터 조건에 맞는 문서가 없습니다',
                    description: '날짜 범위나 카테고리를 변경해보세요.',
                    showAction: false
                }
            };

            const config = messages[type] || messages.default;
            const actionHtml = config.showAction
                ? \`<div class="empty-state-actions">
                     <button class="btn btn-primary" onclick="openModal()">+ 새 문서 작성</button>
                   </div>\`
                : '';

            return \`
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">\${config.icon}</div>
                    <h3>\${config.title}</h3>
                    <p>\${config.description}</p>
                    \${actionHtml}
                </div>
            \`;
        }

        // --- Performance: Search index cache ---
        // Maps doc.id to {titleLower, contentLower} so toLowerCase() is called
        // once per document change, not once per keystroke per document.
        let searchIndex = new Map();

        function buildSearchIndex() {
            searchIndex.clear();
            documents.forEach(doc => {
                searchIndex.set(doc.id, {
                    titleLower: (doc.title || '').toLowerCase(),
                    contentLower: (doc.content || '').toLowerCase()
                });
            });
        }

        function updateSearchIndexEntry(doc) {
            searchIndex.set(doc.id, {
                titleLower: (doc.title || '').toLowerCase(),
                contentLower: (doc.content || '').toLowerCase()
            });
        }

        function removeSearchIndexEntry(id) {
            searchIndex.delete(id);
        }

        // --- Performance: Debounce utility ---
        function debounce(fn, delay) {
            let timer = null;
            return function(...args) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => { fn.apply(this, args); }, delay);
            };
        }

        // Debounced version of filterDocuments for search input (250ms delay)
        const debouncedFilter = debounce(() => { filterDocuments(); }, 250);

        // --- Performance: Pagination state ---
        const PAGE_SIZE = 30;
        let currentPage = 1;
        let lastFilteredDocs = [];

        // --- Performance: Category diff state ---
        let previousCategoryState = null;

        // Claim unclaimed documents for current user
        // Handles: user_id is null, or user_id was set to email instead of Clerk ID
        async function claimUnclaimedDocs() {
            await supabaseClient
                .from('daily_doc')
                .update({ user_id: CURRENT_USER_ID })
                .is('user_id', null);
            await supabaseClient
                .from('daily_doc')
                .update({ user_id: CURRENT_USER_ID })
                .neq('user_id', CURRENT_USER_ID)
                .like('user_id', '%@%');
        }

        // Initialize
        (async () => {
            showLoading('데이터 로딩 중...');
            await claimUnclaimedDocs();
            await loadDocuments();
            renderAll();
            setDefaultDates();
            hideLoading();
        })();

        // Load documents from Supabase
        async function loadDocuments() {
            const { data, error } = await supabaseClient
                .from('daily_doc')
                .select('*')
                .eq('user_id', CURRENT_USER_ID)
                .order('created_at', { ascending: false });
            if (error) {
                showToast('데이터 로딩 실패: ' + error.message, 'error');
                return;
            }
            documents = (data || []).map(row => ({
                id: row.id,
                title: row.title,
                content: row.content || '',
                category: row.category || '',
                status: row.status || '진행중',
                images: row.images || [],
                inlineImages: row.inline_images || {},
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
            buildSearchIndex();
        }

        // Helper: convert JS doc object to DB row format
        function docToRow(doc) {
            return {
                id: doc.id,
                user_id: CURRENT_USER_ID,
                title: doc.title,
                content: doc.content,
                category: doc.category,
                status: doc.status,
                images: doc.images || [],
                inline_images: doc.inlineImages || {},
                created_at: doc.createdAt,
                updated_at: doc.updatedAt
            };
        }

        // Set default dates for filter
        function setDefaultDates() {
            const today = new Date();
            document.getElementById('endDate').value = formatDate(today);
        }

        // Format date to YYYY-MM-DD
        function formatDate(date) {
            return date.toISOString().split('T')[0];
        }

        // Format date for display
        function formatDisplayDate(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Generate unique ID
        function generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        // Render all components
        function renderAll() {
            renderCategories();
            filterDocuments();
            updateStats();
            updateCategoryOptions();
        }

        // Get unique categories
        function getCategories() {
            const categories = {};
            documents.forEach(doc => {
                const cat = doc.category || '미분류';
                categories[cat] = (categories[cat] || 0) + 1;
            });
            return categories;
        }

        // Render category list with diff-based updates
        // Only rebuilds the DOM when category data actually changes.
        function renderCategories() {
            const categories = getCategories();
            const list = document.getElementById('categoryList');

            // Build new state snapshot
            const sortedEntries = Object.entries(categories).sort((a, b) => a[0].localeCompare(b[0]));
            const newState = {
                total: documents.length,
                active: currentCategory,
                entries: sortedEntries
            };

            // Check if state has changed from previous render
            const newStateKey = JSON.stringify(newState);
            if (previousCategoryState === newStateKey) {
                return; // No changes, skip DOM update entirely
            }
            previousCategoryState = newStateKey;

            // State changed -- update DOM using DocumentFragment
            const fragment = document.createDocumentFragment();

            // ===== UX Enhancement: Keyboard Navigation for Categories =====
            const createCategoryItem = (category, name, count, isActive) => {
                const li = document.createElement('li');
                li.className = isActive ? 'active' : '';
                li.dataset.category = category;
                li.setAttribute('role', 'option');
                li.setAttribute('aria-selected', isActive ? 'true' : 'false');
                li.setAttribute('tabindex', isActive ? '0' : '-1');
                li.onclick = () => setCategory(category);

                // Keyboard support for categories
                li.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCategory(category);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = li.nextElementSibling;
                        if (next) next.focus();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prev = li.previousElementSibling;
                        if (prev) prev.focus();
                    }
                };

                li.innerHTML = \`<span>\${escapeHtml(name)}</span><span class="category-count">\${count}</span>\`;
                return li;
            };

            // "All" item
            const allLi = createCategoryItem('all', '전체', documents.length, currentCategory === 'all');
            fragment.appendChild(allLi);

            sortedEntries.forEach(([name, count]) => {
                const li = createCategoryItem(name, name, count, currentCategory === name);
                fragment.appendChild(li);
            });

            list.innerHTML = '';
            list.appendChild(fragment);
        }

        // Update category options in datalist
        function updateCategoryOptions() {
            const categories = Object.keys(getCategories());
            const datalist = document.getElementById('categoryOptions');
            datalist.innerHTML = categories.map(c => \`<option value="\${c}">\`).join('');
        }

        // Set current category filter
        function setCategory(category) {
            currentCategory = category;
            renderCategories();
            filterDocuments();
        }

        // Filter and render documents
        function filterDocuments() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            let filtered = documents.filter(doc => {
                // Category filter
                if (currentCategory !== 'all') {
                    const docCat = doc.category || '미분류';
                    if (docCat !== currentCategory) return false;
                }

                // Search filter -- uses pre-computed search index (no toLowerCase per call)
                if (searchTerm) {
                    const idx = searchIndex.get(doc.id);
                    if (idx) {
                        if (!idx.titleLower.includes(searchTerm) && !idx.contentLower.includes(searchTerm)) return false;
                    } else {
                        // Fallback for docs not yet indexed
                        const titleMatch = (doc.title || '').toLowerCase().includes(searchTerm);
                        const contentMatch = (doc.content || '').toLowerCase().includes(searchTerm);
                        if (!titleMatch && !contentMatch) return false;
                    }
                }

                // Date filter
                const docDate = doc.createdAt.split('T')[0];
                if (startDate && docDate < startDate) return false;
                if (endDate && docDate > endDate) return false;

                return true;
            });

            // Sort by date (newest first)
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Store for pagination
            lastFilteredDocs = filtered;
            currentPage = 1;

            renderDocuments(filtered);
            if (currentView === 'calendar') {
                renderCalendar();
            }
        }

        // Render document cards with pagination and DocumentFragment
        function renderDocuments(docs) {
            const grid = document.getElementById('gridView');
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();

            // ===== UX Enhancement: Improved Empty States =====
            if (docs.length === 0) {
                let emptyType = 'default';
                if (searchTerm) {
                    emptyType = 'search';
                } else if (document.getElementById('startDate').value || document.getElementById('endDate').value || currentCategory !== 'all') {
                    emptyType = 'filter';
                }
                grid.innerHTML = renderEmptyState(emptyType);
                return;
            }

            // Pagination: only render current page
            const totalPages = Math.ceil(docs.length / PAGE_SIZE);
            const startIdx = (currentPage - 1) * PAGE_SIZE;
            const pageDocs = docs.slice(startIdx, startIdx + PAGE_SIZE);

            // Use DocumentFragment to batch DOM insertions
            const fragment = document.createDocumentFragment();

            pageDocs.forEach(doc => {
                const card = document.createElement('div');
                card.className = 'document-card' + (doc.status === 'important' ? ' selected' : '');
                card.setAttribute('role', 'listitem');
                card.setAttribute('tabindex', '0');
                card.onclick = () => viewDocument(doc.id);

                // Keyboard support for document cards
                card.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        viewDocument(doc.id);
                    }
                };

                const imageCountHtml = (doc.images && doc.images.length > 0)
                    ? \`<span class="image-count-badge" aria-label="\${doc.images.length}개의 이미지">🖼️ \${doc.images.length}</span>\`
                    : '';

                // ===== UX Enhancement: Search Highlighting =====
                const titleHtml = searchTerm ? highlightText(doc.title, searchTerm) : escapeHtml(doc.title);
                const previewText = doc.content.substring(0, 150);
                const previewHtml = searchTerm ? highlightText(previewText, searchTerm) : escapeHtml(previewText);

                card.innerHTML = \`
                    <div class="document-header">
                        <div class="document-title">
                            \${titleHtml}
                            \${imageCountHtml}
                        </div>
                        <span class="document-category">\${escapeHtml(doc.category || '미분류')}</span>
                    </div>
                    <div class="document-preview">\${previewHtml}</div>
                    <div class="document-meta">
                        <span>\${formatDisplayDate(doc.createdAt)}</span>
                        <div class="document-actions">
                            <button class="btn btn-secondary btn-sm doc-edit-btn tooltip" data-tooltip="문서 수정" data-id="\${doc.id}" aria-label="문서 수정">수정</button>
                            <button class="btn btn-danger btn-sm doc-delete-btn tooltip" data-tooltip="문서 삭제" data-id="\${doc.id}" aria-label="문서 삭제">삭제</button>
                        </div>
                    </div>
                \`;

                fragment.appendChild(card);
            });

            // Pagination controls
            if (totalPages > 1) {
                const paginationDiv = document.createElement('div');
                paginationDiv.style.cssText = 'grid-column: 1 / -1; display: flex; justify-content: center; align-items: center; gap: 8px; padding: 15px 0;';

                let paginationHtml = '';
                if (currentPage > 1) {
                    paginationHtml += \`<button class="btn btn-secondary btn-sm" onclick="goToPage(\${currentPage - 1})">이전</button>\`;
                }
                // Show page numbers with ellipsis for large ranges
                const maxVisible = 7;
                let startP = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                let endP = Math.min(totalPages, startP + maxVisible - 1);
                if (endP - startP < maxVisible - 1) startP = Math.max(1, endP - maxVisible + 1);

                if (startP > 1) paginationHtml += \`<button class="btn btn-secondary btn-sm" onclick="goToPage(1)">1</button>\`;
                if (startP > 2) paginationHtml += \`<span style="color: var(--text-light);">...</span>\`;

                for (let p = startP; p <= endP; p++) {
                    if (p === currentPage) {
                        paginationHtml += \`<button class="btn btn-primary btn-sm" disabled>\${p}</button>\`;
                    } else {
                        paginationHtml += \`<button class="btn btn-secondary btn-sm" onclick="goToPage(\${p})">\${p}</button>\`;
                    }
                }

                if (endP < totalPages - 1) paginationHtml += \`<span style="color: var(--text-light);">...</span>\`;
                if (endP < totalPages) paginationHtml += \`<button class="btn btn-secondary btn-sm" onclick="goToPage(\${totalPages})">\${totalPages}</button>\`;

                if (currentPage < totalPages) {
                    paginationHtml += \`<button class="btn btn-secondary btn-sm" onclick="goToPage(\${currentPage + 1})">다음</button>\`;
                }
                paginationHtml += \`<span style="margin-left: 10px; color: var(--text-light); font-size: 12px;">(총 \${docs.length}건)</span>\`;

                paginationDiv.innerHTML = paginationHtml;
                fragment.appendChild(paginationDiv);
            }

            grid.innerHTML = '';
            grid.appendChild(fragment);
        }

        // Event delegation: single persistent listener on grid for edit/delete buttons
        // Registered once at initialization, not per render cycle
        (() => {
            document.getElementById('gridView').addEventListener('click', (e) => {
                const editBtn = e.target.closest('.doc-edit-btn');
                const deleteBtn = e.target.closest('.doc-delete-btn');
                if (editBtn) {
                    e.stopPropagation();
                    editDocument(editBtn.dataset.id);
                } else if (deleteBtn) {
                    e.stopPropagation();
                    viewDocument(deleteBtn.dataset.id);
                }
            });
        })();

        function goToPage(page) {
            currentPage = page;
            renderDocuments(lastFilteredDocs);
            // Scroll to top of grid
            document.getElementById('gridView').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        }

        // Update stats
        function updateStats() {
            document.getElementById('totalDocs').textContent = documents.length;
            document.getElementById('totalCategories').textContent = Object.keys(getCategories()).length;
        }

        // Open document modal for new document
        function openModal() {
            document.getElementById('documentId').value = '';
            document.getElementById('modalTitle').textContent = '새 문서 작성';
            document.getElementById('docTitle').value = '';
            document.getElementById('docCategory').value = '';
            document.getElementById('docDate').value = formatDate(new Date());
            document.getElementById('docStatus').value = 'active';
            document.getElementById('docContent').value = '';
            currentImages = [];
            currentInlineImages = {};
            inlineImageCounter = 0;
            renderImagePreviews();
            renderInlineImagePreviews();
            updateWordCount();

            const modal = document.getElementById('documentModal');
            modal.classList.add('active');

            // ===== UX Enhancement: Focus Trap =====
            setupFocusTrap(modal);

            // Focus on first input
            setTimeout(() => {
                document.getElementById('docTitle').focus();
            }, 100);
        }

        // Close document modal
        function closeModal() {
            document.getElementById('documentModal').classList.remove('active');
        }

        // Edit document
        function editDocument(id) {
            const doc = documents.find(d => d.id === id);
            if (!doc) return;

            document.getElementById('documentId').value = doc.id;
            document.getElementById('modalTitle').textContent = '문서 수정';
            document.getElementById('docTitle').value = doc.title;
            document.getElementById('docCategory').value = doc.category || '';
            document.getElementById('docDate').value = doc.createdAt.split('T')[0];
            document.getElementById('docStatus').value = doc.status || 'active';
            document.getElementById('docContent').value = doc.content;
            currentImages = doc.images ? [...doc.images] : [];
            currentInlineImages = doc.inlineImages ? {...doc.inlineImages} : {};
            // Find highest inline image number
            inlineImageCounter = 0;
            Object.keys(currentInlineImages).forEach(key => {
                const num = parseInt(key.replace('IMG', ''));
                if (num > inlineImageCounter) inlineImageCounter = num;
            });
            renderImagePreviews();
            renderInlineImagePreviews();
            updateWordCount();
            document.getElementById('documentModal').classList.add('active');
            closeViewModal();
        }

        // Save document
        async function saveDocument() {
            const id = document.getElementById('documentId').value;
            const title = document.getElementById('docTitle').value.trim();
            const category = document.getElementById('docCategory').value.trim();
            const dateValue = document.getElementById('docDate').value;
            const status = document.getElementById('docStatus').value;
            const content = document.getElementById('docContent').value;

            if (!title) {
                showToast('제목을 입력해주세요.', 'error');
                document.getElementById('docTitle').focus();
                return;
            }

            showLoading('문서 저장 중...');

            const now = new Date().toISOString();

            if (id) {
                // Update existing
                const createdAt = dateValue ? new Date(dateValue).toISOString() : documents.find(d => d.id === id)?.createdAt || now;
                const updatedDoc = { id, title, category, content, status, images: currentImages, inlineImages: currentInlineImages, createdAt, updatedAt: now };

                const { error } = await supabaseClient
                    .from('daily_doc')
                    .update(docToRow(updatedDoc))
                    .eq('id', id)
                    .eq('user_id', CURRENT_USER_ID);

                if (error) {
                    hideLoading();
                    showToast('문서 수정 실패: ' + error.message, 'error');
                    return;
                }

                const index = documents.findIndex(d => d.id === id);
                if (index !== -1) {
                    documents[index] = updatedDoc;
                    updateSearchIndexEntry(updatedDoc);
                }
                showToast('문서가 수정되었습니다.', 'success');
            } else {
                // Create new
                const newDoc = {
                    id: generateId(),
                    title, category, content, status,
                    images: currentImages,
                    inlineImages: currentInlineImages,
                    createdAt: dateValue ? new Date(dateValue).toISOString() : now,
                    updatedAt: now
                };

                const { error } = await supabaseClient
                    .from('daily_doc')
                    .insert(docToRow(newDoc));

                if (error) {
                    hideLoading();
                    showToast('문서 생성 실패: ' + error.message, 'error');
                    return;
                }

                documents.push(newDoc);
                updateSearchIndexEntry(newDoc);
                showToast('새 문서가 생성되었습니다.', 'success');
            }

            hideLoading();
            closeModal();
            renderAll();
        }

        // Delete document
        async function deleteDocument(id) {
            const confirmed = await customConfirm(
                '이 문서를 삭제하시겠습니까? 삭제된 문서는 복구할 수 없습니다.',
                '문서 삭제 확인'
            );

            if (!confirmed) return;

            showLoading('문서 삭제 중...');

            const { error } = await supabaseClient
                .from('daily_doc')
                .delete()
                .eq('id', id)
                .eq('user_id', CURRENT_USER_ID);

            if (error) {
                hideLoading();
                showToast('문서 삭제 실패: ' + error.message, 'error');
                return;
            }

            documents = documents.filter(d => d.id !== id);
            removeSearchIndexEntry(id);
            renderAll();

            hideLoading();
            showToast('문서가 삭제되었습니다.', 'success');
        }

        // View document
        function viewDocument(id) {
            const doc = documents.find(d => d.id === id);
            if (!doc) return;

            currentViewDocId = id;
            originalContent = doc.content; // Store for find functionality
            document.getElementById('viewTitle').textContent = doc.title;
            document.getElementById('viewCategory').textContent = doc.category || '미분류';
            document.getElementById('viewMeta').textContent = \`작성: \${formatDisplayDate(doc.createdAt)}\${doc.updatedAt !== doc.createdAt ? ' | 수정: ' + formatDisplayDate(doc.updatedAt) : ''}\`;

            // Render content with inline images
            const contentWithImages = renderContentWithInlineImages(doc.content, doc.inlineImages || {});
            document.getElementById('viewContent').innerHTML = contentWithImages;

            document.getElementById('findInput').value = '';
            document.getElementById('findCount').textContent = '0 / 0';
            findMatches = [];
            currentFindIndex = -1;

            // Display attached images
            renderViewImages(doc.images || []);

            const modal = document.getElementById('viewModal');
            modal.classList.add('active');

            // ===== UX Enhancement: Focus Trap =====
            setupFocusTrap(modal);
        }

        // Render content with inline images
        function renderContentWithInlineImages(content, inlineImages) {
            if (!content) return '';

            let html = escapeHtml(content);

            // Replace image markers with actual images
            // Pattern: [[IMG1]], [[IMG2]], etc.
            html = html.replace(/\\[\\[IMG(\\d+)\\]\\]/g, (match, num) => {
                const key = 'IMG' + num;
                if (inlineImages[key]) {
                    const imgIndex = Object.keys(inlineImages).indexOf(key);
                    return \`<img src="\${inlineImages[key]}" class="view-inline-image" onclick="openInlineImageLightbox(\${imgIndex}, '\${currentViewDocId}')" alt="삽입 이미지 \${num}">\`;
                }
                return match;
            });

            return html;
        }

        // Open lightbox for inline images
        function openInlineImageLightbox(index, docId) {
            const doc = documents.find(d => d.id === docId);
            if (!doc || !doc.inlineImages) return;

            lightboxImages = Object.entries(doc.inlineImages).map(([key, data]) => ({
                id: key,
                data: data,
                name: '삽입 이미지'
            }));
            lightboxIndex = index;
            document.getElementById('lightboxImage').src = lightboxImages[index].data;
            document.getElementById('lightbox').classList.add('active');
        }

        // Close view modal
        function closeViewModal() {
            document.getElementById('viewModal').classList.remove('active');
            currentViewDocId = null;
            clearFind();
        }

        // Find functionality
        let findMatches = [];
        let currentFindIndex = -1;
        let originalContent = '';

        function performFind() {
            const searchText = document.getElementById('findInput').value;
            const contentEl = document.getElementById('viewContent');
            const doc = documents.find(d => d.id === currentViewDocId);

            // Reset to original content first (with inline images)
            if (originalContent) {
                contentEl.innerHTML = renderContentWithInlineImages(originalContent, doc?.inlineImages || {});
            }

            findMatches = [];
            currentFindIndex = -1;

            if (!searchText || searchText.length === 0) {
                document.getElementById('findCount').textContent = '0 / 0';
                return;
            }

            const content = originalContent;
            const regex = new RegExp(escapeRegex(searchText), 'gi');
            let match;
            let lastIndex = 0;
            let resultHtml = '';
            let matchIndex = 0;

            while ((match = regex.exec(content)) !== null) {
                // Add text before match (with inline image rendering)
                const beforeText = content.substring(lastIndex, match.index);
                resultHtml += renderContentWithInlineImages(beforeText, doc?.inlineImages || {});
                // Add highlighted match
                resultHtml += \`<span class="highlight" data-match-index="\${matchIndex}">\${escapeHtml(match[0])}</span>\`;
                lastIndex = regex.lastIndex;
                findMatches.push(matchIndex);
                matchIndex++;
            }

            // Add remaining text (with inline image rendering)
            const afterText = content.substring(lastIndex);
            resultHtml += renderContentWithInlineImages(afterText, doc?.inlineImages || {});

            contentEl.innerHTML = resultHtml;

            if (findMatches.length > 0) {
                currentFindIndex = 0;
                highlightCurrentMatch();
            }

            updateFindCount();
        }

        function escapeRegex(string) {
            return string.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\\$&');
        }

        function highlightCurrentMatch() {
            // Remove current highlight from all
            document.querySelectorAll('.highlight.current').forEach(el => {
                el.classList.remove('current');
            });

            if (currentFindIndex >= 0 && findMatches.length > 0) {
                const currentEl = document.querySelector(\`[data-match-index="\${currentFindIndex}"]\`);
                if (currentEl) {
                    currentEl.classList.add('current');
                    currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }

        function findNext() {
            if (findMatches.length === 0) return;
            currentFindIndex = (currentFindIndex + 1) % findMatches.length;
            highlightCurrentMatch();
            updateFindCount();
        }

        function findPrev() {
            if (findMatches.length === 0) return;
            currentFindIndex = (currentFindIndex - 1 + findMatches.length) % findMatches.length;
            highlightCurrentMatch();
            updateFindCount();
        }

        function updateFindCount() {
            const countEl = document.getElementById('findCount');
            if (findMatches.length === 0) {
                countEl.textContent = '0 / 0';
            } else {
                countEl.textContent = \`\${currentFindIndex + 1} / \${findMatches.length}\`;
            }
        }

        function clearFind() {
            document.getElementById('findInput').value = '';
            findMatches = [];
            currentFindIndex = -1;
            document.getElementById('findCount').textContent = '0 / 0';

            // Restore original content with inline images
            if (originalContent) {
                const doc = documents.find(d => d.id === currentViewDocId);
                document.getElementById('viewContent').innerHTML = renderContentWithInlineImages(originalContent, doc?.inlineImages || {});
            }
        }

        // Edit from view modal
        function editFromView() {
            if (currentViewDocId) {
                editDocument(currentViewDocId);
            }
        }

        // Delete from view modal
        async function deleteFromView() {
            if (currentViewDocId) {
                await deleteDocument(currentViewDocId);
                closeViewModal();
            }
        }

        // Clear date filter
        function clearDateFilter() {
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';
            filterDocuments();
        }

        // Update word count
        function updateWordCount() {
            const content = document.getElementById('docContent').value;
            document.getElementById('wordCount').textContent = content.length;
            document.getElementById('lineCount').textContent = content ? content.split('\\n').length : 0;
        }

        // Show toast notification
        function showToast(message, type = '') {
            const toast = document.createElement('div');
            toast.className = \`toast \${type}\`;
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, 3000);
        }

        // Toggle dropdown menu -- fixed to prevent listener accumulation
        // Uses a single global listener registered once, instead of adding a new
        // listener per toggle call.
        let activeDropdownId = null;

        function toggleDropdown(id) {
            const menu = document.getElementById(id);
            const button = menu.previousElementSibling;

            if (activeDropdownId === id && menu.classList.contains('active')) {
                // Close currently open dropdown
                menu.classList.remove('active');
                activeDropdownId = null;

                // ===== UX Enhancement: Update ARIA attribute =====
                if (button) button.setAttribute('aria-expanded', 'false');
            } else {
                // Close any other open dropdown first
                if (activeDropdownId) {
                    const prev = document.getElementById(activeDropdownId);
                    if (prev) {
                        prev.classList.remove('active');
                        const prevBtn = prev.previousElementSibling;
                        if (prevBtn) prevBtn.setAttribute('aria-expanded', 'false');
                    }
                }
                menu.classList.add('active');
                activeDropdownId = id;

                // ===== UX Enhancement: Update ARIA attribute =====
                if (button) button.setAttribute('aria-expanded', 'true');
            }
        }

        // Single global click listener for closing dropdowns (registered once)
        document.addEventListener('click', (e) => {
            if (!activeDropdownId) return;
            const menu = document.getElementById(activeDropdownId);
            if (!menu) return;
            // Check if click is outside both the menu and its parent dropdown button
            const dropdownParent = menu.closest('.dropdown');
            if (!dropdownParent || !dropdownParent.contains(e.target)) {
                menu.classList.remove('active');
                activeDropdownId = null;
            }
        });

        // Export data
        async function exportData() {
            // ===== UX Enhancement: Loading State and Better Feedback =====
            showLoading('데이터 내보내기 중...');
            await new Promise(resolve => setTimeout(resolve, 200));

            try {
                const data = JSON.stringify(documents, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`documents_backup_\${formatDate(new Date())}.json\`;
                a.click();
                URL.revokeObjectURL(url);

                hideLoading();
                showToast(\`\${documents.length}개의 문서가 내보내기 되었습니다.\`, 'success');
            } catch (err) {
                hideLoading();
                showToast('데이터 내보내기 중 오류가 발생했습니다.', 'error');
            }
        }

        // Import data
        async function importData(event) {
            const file = event.target.files[0];
            if (!file) return;

            const confirmed = await customConfirm(
                \`파일 "\${file.name}"을 가져오시겠습니까?\\n중복되지 않는 문서만 추가됩니다.\`,
                '데이터 가져오기 확인'
            );

            if (!confirmed) {
                event.target.value = '';
                return;
            }

            showLoading('데이터 가져오는 중...');

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedDocs = JSON.parse(e.target.result);
                    if (!Array.isArray(importedDocs)) {
                        throw new Error('Invalid format');
                    }

                    // Convert imported docs to DB row format and upsert
                    const rows = importedDocs.map(doc => ({
                        id: doc.id,
                        user_id: CURRENT_USER_ID,
                        title: doc.title,
                        content: doc.content || '',
                        category: doc.category || '',
                        status: doc.status || '진행중',
                        images: doc.images || [],
                        inline_images: doc.inlineImages || {},
                        created_at: doc.createdAt || new Date().toISOString(),
                        updated_at: doc.updatedAt || new Date().toISOString()
                    }));

                    const { error } = await supabaseClient
                        .from('daily_doc')
                        .upsert(rows, { onConflict: 'id' });

                    if (error) {
                        hideLoading();
                        showToast('데이터 가져오기 실패: ' + error.message, 'error');
                        return;
                    }

                    // Reload all documents from DB
                    await loadDocuments();
                    renderAll();

                    hideLoading();
                    showToast(\`\${importedDocs.length}개의 문서를 가져왔습니다.\`, 'success');
                } catch (err) {
                    hideLoading();
                    showToast('파일 형식이 올바르지 않습니다. JSON 파일을 확인해주세요.', 'error');
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        // Set view mode
        function setView(view) {
            currentView = view;
            document.getElementById('gridView').style.display = view === 'grid' ? 'grid' : 'none';
            document.getElementById('calendarView').style.display = view === 'calendar' ? 'block' : 'none';

            const gridBtn = document.getElementById('gridViewBtn');
            const calendarBtn = document.getElementById('calendarViewBtn');

            gridBtn.classList.toggle('active', view === 'grid');
            calendarBtn.classList.toggle('active', view === 'calendar');

            // ===== UX Enhancement: Update ARIA pressed state =====
            gridBtn.setAttribute('aria-pressed', view === 'grid' ? 'true' : 'false');
            calendarBtn.setAttribute('aria-pressed', view === 'calendar' ? 'true' : 'false');

            if (view === 'calendar') {
                renderCalendar();
            }
        }

        // Render calendar
        function renderCalendar() {
            const year = calendarDate.getFullYear();
            const month = calendarDate.getMonth();

            document.getElementById('calendarTitle').textContent = \`\${year}년 \${month + 1}월\`;

            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startDay = firstDay.getDay();

            // Get document counts by date
            const docsByDate = {};
            documents.forEach(doc => {
                const date = doc.createdAt.split('T')[0];
                docsByDate[date] = (docsByDate[date] || 0) + 1;
            });

            const today = formatDate(new Date());
            let html = ['일', '월', '화', '수', '목', '금', '토'].map(d =>
                \`<div class="calendar-day-header">\${d}</div>\`
            ).join('');

            // Previous month days
            const prevMonthLast = new Date(year, month, 0).getDate();
            for (let i = startDay - 1; i >= 0; i--) {
                html += \`<div class="calendar-day other-month">\${prevMonthLast - i}</div>\`;
            }

            // Current month days
            for (let day = 1; day <= lastDay.getDate(); day++) {
                const dateStr = \`\${year}-\${String(month + 1).padStart(2, '0')}-\${String(day).padStart(2, '0')}\`;
                const isToday = dateStr === today;
                const hasDocs = docsByDate[dateStr];

                html += \`
                    <div class="calendar-day \${isToday ? 'today' : ''} \${hasDocs ? 'has-docs' : ''}"
                         onclick="filterByDate('\${dateStr}')"
                         title="\${hasDocs ? hasDocs + '개의 문서' : ''}">
                        \${day}
                    </div>
                \`;
            }

            // Next month days
            const remaining = (7 - ((startDay + lastDay.getDate()) % 7)) % 7;
            for (let i = 1; i <= remaining; i++) {
                html += \`<div class="calendar-day other-month">\${i}</div>\`;
            }

            document.getElementById('calendarGrid').innerHTML = html;
        }

        // Filter by specific date
        function filterByDate(dateStr) {
            document.getElementById('startDate').value = dateStr;
            document.getElementById('endDate').value = dateStr;
            setView('grid');
            filterDocuments();
        }

        // Calendar navigation
        function prevMonth() {
            calendarDate.setMonth(calendarDate.getMonth() - 1);
            renderCalendar();
        }

        function nextMonth() {
            calendarDate.setMonth(calendarDate.getMonth() + 1);
            renderCalendar();
        }

        function goToday() {
            calendarDate = new Date();
            renderCalendar();
        }

        // Category manager
        function openCategoryManager() {
            const categories = getCategories();
            let html = '';

            Object.entries(categories).sort().forEach(([name, count]) => {
                html += \`
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border);">
                        <span>\${escapeHtml(name)} <span style="color: var(--text-light);">(\${count}개)</span></span>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary btn-sm" onclick="renameCategory('\${escapeHtml(name)}')">이름 변경</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteCategory('\${escapeHtml(name)}')">삭제</button>
                        </div>
                    </div>
                \`;
            });

            if (!html) {
                html = '<p style="padding: 20px; text-align: center; color: var(--text-light);">카테고리가 없습니다.</p>';
            }

            document.getElementById('categoryManagerList').innerHTML = html;
            document.getElementById('categoryModal').classList.add('active');
        }

        function closeCategoryModal() {
            document.getElementById('categoryModal').classList.remove('active');
        }

        async function renameCategory(oldName) {
            const newName = prompt('새 카테고리 이름:', oldName);
            if (!newName || newName === oldName) return;

            showLoading('카테고리 변경 중...');

            const { error } = await supabaseClient
                .from('daily_doc')
                .update({ category: newName })
                .eq('category', oldName)
                .eq('user_id', CURRENT_USER_ID);

            if (error) {
                hideLoading();
                showToast('카테고리 변경 실패: ' + error.message, 'error');
                return;
            }

            documents.forEach(doc => {
                if (doc.category === oldName) {
                    doc.category = newName;
                }
            });

            hideLoading();
            renderAll();
            openCategoryManager();
            showToast('카테고리 이름이 변경되었습니다.', 'success');
        }

        async function deleteCategory(name) {
            const confirmed = await customConfirm(
                \`"\${name}" 카테고리의 모든 문서를 "미분류"로 변경하시겠습니까?\`,
                '카테고리 삭제 확인'
            );
            if (!confirmed) return;

            showLoading('카테고리 삭제 중...');

            const { error } = await supabaseClient
                .from('daily_doc')
                .update({ category: '' })
                .eq('category', name)
                .eq('user_id', CURRENT_USER_ID);

            if (error) {
                hideLoading();
                showToast('카테고리 삭제 실패: ' + error.message, 'error');
                return;
            }

            documents.forEach(doc => {
                if (doc.category === name) {
                    doc.category = '';
                }
            });

            hideLoading();
            renderAll();
            openCategoryManager();
            showToast('카테고리가 삭제되었습니다.');
        }

        // Inline image paste handling
        function handlePaste(event) {
            const items = event.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    event.preventDefault();
                    const file = items[i].getAsFile();
                    insertInlineImage(file);
                    break;
                }
            }
        }

        async function insertInlineImage(file) {
            const MAX_RAW_SIZE = 10 * 1024 * 1024; // 10MB raw limit
            const MAX_DIMENSION = 1280;
            const QUALITY = 0.8;

            if (file.size > MAX_RAW_SIZE) {
                showToast('이미지 크기가 너무 큽니다 (최대 10MB).', 'error');
                return;
            }

            try {
                const resizedData = await resizeImage(file, MAX_DIMENSION, MAX_DIMENSION, QUALITY);

                inlineImageCounter++;
                const marker = 'IMG' + inlineImageCounter;
                currentInlineImages[marker] = resizedData;

                // Insert marker at cursor position in textarea
                const textarea = document.getElementById('docContent');
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const markerText = \`[[\${marker}]]\`;

                textarea.value = text.substring(0, start) + markerText + text.substring(end);

                // Move cursor after the marker
                textarea.selectionStart = textarea.selectionEnd = start + markerText.length;
                textarea.focus();

                renderInlineImagePreviews();
                updateWordCount();

                if (file.size > 2 * 1024 * 1024) {
                    showToast('이미지가 자동 리사이즈되어 본문에 삽입되었습니다.', 'success');
                } else {
                    showToast('이미지가 본문에 삽입되었습니다.', 'success');
                }
            } catch (err) {
                showToast('이미지 처리 중 오류가 발생했습니다.', 'error');
            }
        }

        function renderInlineImagePreviews() {
            const container = document.getElementById('inlineImagesPreview');
            const list = document.getElementById('inlineImageList');
            const keys = Object.keys(currentInlineImages);

            if (keys.length === 0) {
                container.classList.remove('has-images');
                list.innerHTML = '';
                return;
            }

            container.classList.add('has-images');
            list.innerHTML = keys.map(key => \`
                <div class="inline-image-item">
                    <img src="\${currentInlineImages[key]}" alt="\${key}">
                    <span class="inline-img-label">[[\${key}]]</span>
                    <button class="remove-inline-img" onclick="removeInlineImage('\${key}')">&times;</button>
                </div>
            \`).join('');
        }

        function removeInlineImage(key) {
            // Remove from storage
            delete currentInlineImages[key];

            // Remove marker from text
            const textarea = document.getElementById('docContent');
            textarea.value = textarea.value.replace(\`[[\${key}]]\`, '');

            renderInlineImagePreviews();
            updateWordCount();
        }

        // Image handling functions
        function handleImageUpload(event) {
            const files = event.target.files;
            processImageFiles(files);
            event.target.value = ''; // Reset input
        }

        // --- Performance: Image resizing via Canvas API ---
        // Resizes an image to fit within maxWidth x maxHeight while preserving aspect ratio.
        // Returns a Promise that resolves with the resized data URL.
        function resizeImage(file, maxWidth, maxHeight, quality) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = reject;
                reader.onload = (e) => {
                    const img = new Image();
                    img.onerror = reject;
                    img.onload = () => {
                        let { width, height } = img;

                        // Only resize if exceeds limits
                        if (width > maxWidth || height > maxHeight) {
                            const ratio = Math.min(maxWidth / width, maxHeight / height);
                            width = Math.round(width * ratio);
                            height = Math.round(height * ratio);
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Use JPEG for photos (smaller), PNG for transparency
                        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                        const dataUrl = canvas.toDataURL(mimeType, quality);
                        resolve(dataUrl);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        async function processImageFiles(files) {
            const MAX_DIMENSION = 1280; // Max width or height in pixels
            const QUALITY = 0.8; // JPEG compression quality (0-1)
            const MAX_RAW_SIZE = 10 * 1024 * 1024; // Reject files above 10MB outright

            // ===== UX Enhancement: Loading State for Image Processing =====
            const fileArray = Array.from(files);
            if (fileArray.length === 0) return;

            showLoading(\`이미지 처리 중... (0/\${fileArray.length})\`);
            let processedCount = 0;

            for (const file of fileArray) {
                if (!file.type.startsWith('image/')) {
                    showToast('이미지 파일만 업로드 가능합니다.', 'error');
                    processedCount++;
                    continue;
                }

                if (file.size > MAX_RAW_SIZE) {
                    showToast(\`\${file.name}: 파일 크기가 너무 큽니다 (최대 10MB).\`, 'error');
                    processedCount++;
                    continue;
                }

                try {
                    const resized = await resizeImage(file, MAX_DIMENSION, MAX_DIMENSION, QUALITY);
                    currentImages.push({
                        id: generateId(),
                        data: resized,
                        name: file.name
                    });
                    renderImagePreviews();
                    processedCount++;

                    // Update loading text
                    const loadingText = document.getElementById('loadingText');
                    if (loadingText) {
                        loadingText.textContent = \`이미지 처리 중... (\${processedCount}/\${fileArray.length})\`;
                    }

                    if (file.size > 2 * 1024 * 1024) {
                        showToast(\`\${file.name}: 이미지가 자동으로 리사이즈되었습니다.\`, 'success');
                    }
                } catch (err) {
                    showToast(\`\${file.name}: 이미지 처리 중 오류가 발생했습니다.\`, 'error');
                    processedCount++;
                }
            }

            hideLoading();
            if (processedCount > 0) {
                showToast(\`\${processedCount}개의 이미지가 추가되었습니다.\`, 'success');
            }
        }

        function renderImagePreviews() {
            const grid = document.getElementById('imagePreviewGrid');
            if (currentImages.length === 0) {
                grid.innerHTML = '';
                return;
            }

            grid.innerHTML = currentImages.map((img, index) => \`
                <div class="image-preview-item">
                    <img src="\${img.data}" alt="\${escapeHtml(img.name)}" onclick="openLightboxFromEdit(\${index})">
                    <button class="remove-image" onclick="removeImage('\${img.id}')">&times;</button>
                </div>
            \`).join('');
        }

        function removeImage(imageId) {
            currentImages = currentImages.filter(img => img.id !== imageId);
            renderImagePreviews();
        }

        function renderViewImages(images) {
            const grid = document.getElementById('viewImagesGrid');
            lightboxImages = images;

            if (!images || images.length === 0) {
                grid.style.display = 'none';
                grid.innerHTML = '';
                return;
            }

            grid.style.display = 'grid';
            grid.innerHTML = images.map((img, index) => \`
                <div class="view-image-item" onclick="openLightbox(\${index})">
                    <img src="\${img.data}" alt="\${escapeHtml(img.name || '이미지')}">
                </div>
            \`).join('');
        }

        function openLightbox(index) {
            lightboxIndex = index;
            document.getElementById('lightboxImage').src = lightboxImages[index].data;
            document.getElementById('lightbox').classList.add('active');
        }

        function openLightboxFromEdit(index) {
            lightboxImages = currentImages;
            openLightbox(index);
        }

        function closeLightbox(event) {
            if (event && event.target !== event.currentTarget) return;
            document.getElementById('lightbox').classList.remove('active');
        }

        function lightboxPrev() {
            lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
            document.getElementById('lightboxImage').src = lightboxImages[lightboxIndex].data;
        }

        function lightboxNext() {
            lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
            document.getElementById('lightboxImage').src = lightboxImages[lightboxIndex].data;
        }

        // Drag and drop for images
        const uploadArea = document.getElementById('imageUploadArea');

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            processImageFiles(files);
        });

        // ===== UX Enhancement: Keyboard Accessibility for Image Upload =====
        uploadArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('imageInput').click();
            }
        });

        // Paste event for inline images in textarea
        document.getElementById('docContent').addEventListener('paste', handlePaste);

        // Date filter listeners
        document.getElementById('startDate').addEventListener('change', filterDocuments);
        document.getElementById('endDate').addEventListener('change', filterDocuments);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape to close modals and lightbox
            if (e.key === 'Escape') {
                if (document.getElementById('lightbox').classList.contains('active')) {
                    closeLightbox();
                    return;
                }
                closeModal();
                closeViewModal();
                closeCategoryModal();
            }
            // Arrow keys for lightbox navigation
            if (document.getElementById('lightbox').classList.contains('active')) {
                if (e.key === 'ArrowLeft') lightboxPrev();
                if (e.key === 'ArrowRight') lightboxNext();
            }
            // Ctrl+N for new document
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                openModal();
            }
            // Ctrl+S to save in modal
            if (e.ctrlKey && e.key === 's') {
                if (document.getElementById('documentModal').classList.contains('active')) {
                    e.preventDefault();
                    saveDocument();
                }
            }
            // Ctrl+F for find in view modal
            if (e.ctrlKey && e.key === 'f') {
                if (document.getElementById('viewModal').classList.contains('active')) {
                    e.preventDefault();
                    document.getElementById('findInput').focus();
                    document.getElementById('findInput').select();
                }
            }
        });

        // Find input keyboard handling
        document.getElementById('findInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    findPrev();
                } else {
                    findNext();
                }
            }
        });

        // Expose functions to global scope for inline onclick handlers
        Object.assign(window, {
            openModal, closeModal, saveDocument, deleteDocument,
            editDocument, viewDocument, closeViewModal,
            editFromView, deleteFromView,
            setCategory, clearDateFilter,
            setView, toggleDropdown, exportData,
            openCategoryManager, closeCategoryModal,
            renameCategory, deleteCategory,
            prevMonth, nextMonth, goToday, filterByDate,
            goToPage, performFind, findNext, findPrev, clearFind,
            openLightbox, openLightboxFromEdit, closeLightbox,
            lightboxPrev, lightboxNext,
            openInlineImageLightbox, removeInlineImage, removeImage,
            handleImageUpload, importData,
            updateWordCount, debouncedFilter
        });
`;
