export const SPA_HTML = `
    <a href="#main-content" class="skip-link">본문으로 건너뛰기</a>
    <div class="container">
        <header role="banner">
            <h1>일자별 문서 보관함</h1>
            <div class="header-controls" role="status" aria-live="polite">
                <span class="stat-item">총 <strong id="totalDocs">0</strong>개의 문서</span>
                <span class="stat-item" aria-hidden="true">|</span>
                <span class="stat-item"><strong id="totalCategories">0</strong>개의 카테고리</span>
            </div>
        </header>

        <div class="main-layout">
            <aside class="sidebar" role="complementary" aria-label="필터 및 카테고리">
                <div class="filter-section">
                    <h3>날짜 필터</h3>
                    <label for="startDate">시작일</label>
                    <input type="date" id="startDate" aria-label="시작일 선택">
                    <label for="endDate" style="margin-top: 10px;">종료일</label>
                    <input type="date" id="endDate" aria-label="종료일 선택">
                    <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 10px;" onclick="clearDateFilter()" aria-label="날짜 필터 초기화">
                        날짜 필터 초기화
                    </button>
                </div>

                <div class="filter-section">
                    <h3>카테고리</h3>
                    <ul class="category-list" id="categoryList" role="listbox" aria-label="카테고리 목록">
                        <li class="active" data-category="all" role="option" aria-selected="true" tabindex="0">
                            <span>전체</span>
                            <span class="category-count" id="allCount">0</span>
                        </li>
                    </ul>
                    <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 10px;" onclick="openCategoryManager()" aria-label="카테고리 관리">
                        카테고리 관리
                    </button>
                </div>
            </aside>

            <div class="main-content" id="main-content" role="main">
                <div class="toolbar" role="toolbar" aria-label="문서 작업 도구">
                    <div class="search-box">
                        <input type="text" id="searchInput" placeholder="문서 검색 (제목, 내용)..." oninput="debouncedFilter()" aria-label="문서 검색">
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div class="view-toggle" role="group" aria-label="보기 모드 선택">
                            <button class="active" onclick="setView('grid')" id="gridViewBtn" aria-pressed="true" aria-label="목록 보기">목록</button>
                            <button onclick="setView('calendar')" id="calendarViewBtn" aria-pressed="false" aria-label="캘린더 보기">캘린더</button>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-secondary tooltip" data-tooltip="데이터 내보내기/가져오기" onclick="toggleDropdown('exportMenu')" aria-expanded="false" aria-haspopup="true" aria-controls="exportMenu">
                                내보내기/가져오기
                            </button>
                            <div class="dropdown-menu" id="exportMenu" role="menu">
                                <button onclick="exportData()" role="menuitem">JSON으로 내보내기</button>
                                <button onclick="document.getElementById('importFile').click()" role="menuitem">JSON 가져오기</button>
                                <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(event)" aria-label="JSON 파일 선택">
                            </div>
                        </div>
                        <button class="btn btn-primary tooltip" data-tooltip="새 문서 작성 (Ctrl+N)" onclick="openModal()" aria-label="새 문서 작성">
                            + 새 문서
                        </button>
                    </div>
                </div>

                <div id="gridView" class="documents-grid" role="list" aria-label="문서 목록"></div>

                <div id="calendarView" class="calendar-view" style="display: none;">
                    <div class="calendar-header">
                        <h3 id="calendarTitle">2024년 1월</h3>
                        <div class="calendar-nav">
                            <button class="btn btn-secondary btn-sm" onclick="prevMonth()">◀ 이전</button>
                            <button class="btn btn-secondary btn-sm" onclick="goToday()">오늘</button>
                            <button class="btn btn-secondary btn-sm" onclick="nextMonth()">다음 ▶</button>
                        </div>
                    </div>
                    <div class="calendar-grid" id="calendarGrid"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Document Modal -->
    <div class="modal-overlay" id="documentModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal">
            <div class="modal-header">
                <h2 id="modalTitle">새 문서 작성</h2>
                <button class="modal-close" onclick="closeModal()" aria-label="모달 닫기">&times;</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="documentId">
                <div class="form-row">
                    <div class="form-group">
                        <label for="docTitle">제목 *</label>
                        <input type="text" id="docTitle" placeholder="문서 제목을 입력하세요" required aria-required="true">
                    </div>
                    <div class="form-group">
                        <label for="docCategory">카테고리</label>
                        <input type="text" id="docCategory" list="categoryOptions" placeholder="카테고리 입력 또는 선택" aria-label="카테고리 선택">
                        <datalist id="categoryOptions"></datalist>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="docDate">작성일</label>
                        <input type="date" id="docDate" aria-label="작성일 선택">
                    </div>
                    <div class="form-group">
                        <label for="docStatus">문서 상태</label>
                        <select id="docStatus" aria-label="문서 상태 선택">
                            <option value="active">활성</option>
                            <option value="archived">보관</option>
                            <option value="important">중요</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label for="docContent">내용</label>
                    <textarea id="docContent" placeholder="문서 내용을 입력하세요... (Ctrl+V로 캡처 이미지 붙여넣기 가능)" oninput="updateWordCount()" aria-label="문서 내용"></textarea>
                    <div class="word-count">
                        <span id="wordCount">0</span>자 / <span id="lineCount">0</span>줄
                    </div>
                    <div class="paste-hint">💡 캡처한 이미지를 Ctrl+V로 붙여넣으면 현재 커서 위치에 삽입됩니다</div>
                    <div class="inline-images-preview" id="inlineImagesPreview">
                        <h4>📎 본문 내 삽입된 이미지</h4>
                        <div class="inline-image-list" id="inlineImageList"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="imageInput">이미지 첨부</label>
                    <div class="image-upload-area" id="imageUploadArea" onclick="document.getElementById('imageInput').click()" role="button" tabindex="0" aria-label="이미지 업로드 영역">
                        <div class="image-upload-icon" aria-hidden="true">🖼️</div>
                        <div class="image-upload-text">클릭하거나 이미지를 드래그하여 업로드<br>(PNG, JPG, GIF, WebP)</div>
                    </div>
                    <input type="file" id="imageInput" accept="image/*" multiple style="display:none" onchange="handleImageUpload(event)" aria-label="이미지 파일 선택">
                    <div class="image-preview-grid" id="imagePreviewGrid" role="list" aria-label="첨부된 이미지"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()" aria-label="취소">취소</button>
                <button class="btn btn-primary" onclick="saveDocument()" aria-label="문서 저장">저장</button>
            </div>
        </div>
    </div>

    <!-- View Document Modal -->
    <div class="modal-overlay" id="viewModal" role="dialog" aria-modal="true" aria-labelledby="viewTitle">
        <div class="modal">
            <div class="modal-header">
                <h2 id="viewTitle">문서 보기</h2>
                <button class="modal-close" onclick="closeViewModal()" aria-label="모달 닫기">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 15px;">
                    <span class="document-category" id="viewCategory"></span>
                    <span style="margin-left: 10px; color: var(--text-light); font-size: 13px;" id="viewMeta"></span>
                </div>
                <div class="find-bar" role="search" aria-label="문서 내 검색">
                    <input type="text" id="findInput" placeholder="문서 내 단어 찾기 (Ctrl+F)" oninput="performFind()" aria-label="검색어 입력">
                    <span class="find-count" id="findCount" aria-live="polite">0 / 0</span>
                    <div class="find-nav">
                        <button onclick="findPrev()" title="이전 (Shift+Enter)" aria-label="이전 검색 결과">▲</button>
                        <button onclick="findNext()" title="다음 (Enter)" aria-label="다음 검색 결과">▼</button>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="clearFind()" aria-label="검색 초기화">초기화</button>
                </div>
                <div id="viewContent" style="white-space: pre-wrap; line-height: 1.8; font-size: 15px;" role="article"></div>
                <div class="view-images-grid" id="viewImagesGrid" role="list" aria-label="첨부 이미지"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger" onclick="deleteFromView()" aria-label="문서 삭제">삭제</button>
                <button class="btn btn-primary" onclick="editFromView()" aria-label="문서 수정">수정</button>
            </div>
        </div>
    </div>

    <!-- Image Lightbox -->
    <div class="lightbox" id="lightbox" onclick="closeLightbox(event)" role="dialog" aria-modal="true" aria-label="이미지 확대 보기">
        <button class="lightbox-close" onclick="closeLightbox()" aria-label="이미지 닫기">&times;</button>
        <button class="lightbox-nav lightbox-prev" onclick="event.stopPropagation(); lightboxPrev()" aria-label="이전 이미지">◀</button>
        <img id="lightboxImage" src="" alt="확대된 이미지">
        <button class="lightbox-nav lightbox-next" onclick="event.stopPropagation(); lightboxNext()" aria-label="다음 이미지">▶</button>
    </div>

    <!-- Category Manager Modal -->
    <div class="modal-overlay" id="categoryModal" role="dialog" aria-modal="true" aria-labelledby="categoryModalTitle">
        <div class="modal" style="max-width: 500px;">
            <div class="modal-header">
                <h2 id="categoryModalTitle">카테고리 관리</h2>
                <button class="modal-close" onclick="closeCategoryModal()" aria-label="모달 닫기">&times;</button>
            </div>
            <div class="modal-body">
                <div id="categoryManagerList"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeCategoryModal()" aria-label="닫기">닫기</button>
            </div>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div class="loading-overlay" id="loadingOverlay" role="status" aria-live="assertive" aria-label="로딩 중">
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text" id="loadingText">처리 중...</div>
        </div>
    </div>

    <!-- Custom Confirm Dialog -->
    <div class="confirm-dialog-overlay" id="confirmDialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
        <div class="confirm-dialog">
            <div class="confirm-dialog-header">
                <h3 id="confirmTitle">확인</h3>
            </div>
            <div class="confirm-dialog-body">
                <p id="confirmMessage"></p>
            </div>
            <div class="confirm-dialog-footer">
                <button class="btn btn-secondary" id="confirmCancelBtn" aria-label="취소">취소</button>
                <button class="btn btn-danger" id="confirmOkBtn" aria-label="확인">확인</button>
            </div>
        </div>
    </div>
`;
