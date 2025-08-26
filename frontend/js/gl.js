// =====================================================
// GENERAL LEDGER JAVASCRIPT MODULE
// Complete client-side functionality for GL management
// File: frontend/js/gl.js
// =====================================================

class GeneralLedgerManager {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.recordsPerPage = 50;
        this.allEntries = [];
        this.accounts = [];
        this.currentSort = { column: null, direction: 'asc' };
        this.searchTimeout = null;
        this.currentFilters = {};
        this.isLoading = false;
        
        // Exchange rates (make this configurable)
        this.exchangeRates = {
            'USD': 3.675,
            'EUR': 4.1,
            'GBP': 4.65,
            'SAR': 0.98
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadAccounts();
        this.loadGeneralLedger();
        this.loadStatistics();
        this.setDefaultValues();
    }
    
    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('glSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.handleSearch(e.target.value);
                }, 300);
            });
        }
        
        // Clear search
        const clearSearchBtn = document.getElementById('clearGLSearch');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.handleSearch('');
            });
        }
        
        // Records per page
        const recordsPerPageSelect = document.getElementById('glRecordsPerPage');
        if (recordsPerPageSelect) {
            recordsPerPageSelect.addEventListener('change', (e) => {
                this.recordsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.loadGeneralLedger();
            });
        }
        
        // Filter events
        const filterElements = [
            'glFilterAccount', 'glFilterDateFrom', 'glFilterDateTo', 
            'glFilterJV', 'glFilterCurrency', 'glFilterDC', 'glFilterPending'
        ];
        
        filterElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    element.addEventListener('change', () => this.applyFilters());
                } else {
                    element.addEventListener('change', () => this.applyFilters());
                }
            }
        });
        
        // Form submission
        const entryForm = document.getElementById('glEntryForm');
        if (entryForm) {
            entryForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }
        
        // Modal events
        const modal = document.getElementById('glEntryModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }
        
        // Account dropdown change
        const accountSelect = document.getElementById('glAccountNumber');
        if (accountSelect) {
            accountSelect.addEventListener('change', () => {
                this.updateAccountName();
            });
        }
        
        // Currency change
        const currencySelect = document.getElementById('glCurrencyCode');
        if (currencySelect) {
            currencySelect.addEventListener('change', () => {
                this.calculateAmounts();
            });
        }
        
        // Amount calculation
        const foreignAmountInput = document.getElementById('glForeignAmount');
        if (foreignAmountInput) {
            foreignAmountInput.addEventListener('input', () => {
                this.calculateAmounts();
            });
        }
        
        // Debit/Credit change
        const dcSelect = document.getElementById('glDebitCredit');
        if (dcSelect) {
            dcSelect.addEventListener('change', () => {
                this.updateAmountStyles();
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.showAddModal();
            }
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                if (searchInput) searchInput.focus();
            }
        });
    }
    
    setDefaultValues() {
        // Set today's date
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('glTransactionDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = today;
        }
        
        // Set current year
        const yearInput = document.getElementById('glYearPeriod');
        if (yearInput && !yearInput.value) {
            yearInput.value = new Date().getFullYear();
        }
        
        // Set default currency
        const currencySelect = document.getElementById('glCurrencyCode');
        if (currencySelect && !currencySelect.value) {
            currencySelect.value = 'AED';
        }
        
        // Set default user
        const createdByInput = document.getElementById('glCreatedBy');
        if (createdByInput && !createdByInput.value) {
            createdByInput.value = 'USER';
        }
    }
    
    async loadAccounts() {
        try {
            const response = await fetch('/api/accounts');
            const result = await response.json();
            
            if (result.success) {
                this.accounts = result.data;
                this.populateAccountDropdowns();
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
            this.showToast('Error loading accounts', 'error');
        }
    }
    
    populateAccountDropdowns() {
        const selects = ['glAccountNumber', 'glFilterAccount'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                // Clear existing options except first
                const firstOption = select.querySelector('option:first-child');
                select.innerHTML = '';
                if (firstOption) {
                    select.appendChild(firstOption);
                }
                
                // Add account options
                this.accounts.forEach(account => {
                    const option = document.createElement('option');
                    option.value = account.pts_account_no;
                    option.textContent = `${account.pts_account_no} - ${account.name || 'Unnamed'}`;
                    select.appendChild(option);
                });
            }
        });
    }
    
    async loadGeneralLedger() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        this.hideError();
        
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.recordsPerPage,
                search: document.getElementById('glSearchInput')?.value || '',
                account: this.currentFilters.account || '',
                date_from: this.currentFilters.dateFrom || '',
                date_to: this.currentFilters.dateTo || '',
                jv_number: this.currentFilters.jvNumber || '',
                currency: this.currentFilters.currency || '',
                debit_credit: this.currentFilters.debitCredit || '',
                pending_only: this.currentFilters.pendingOnly || ''
            });
            
            const response = await fetch(`/api/general-ledger?${params}`);
            const result = await response.json();
            
            if (result.success) {
                this.allEntries = result.data;
                this.totalPages = result.pagination.totalPages;
                this.currentPage = result.pagination.currentPage;
                
                this.renderTable();
                this.updatePagination();
                this.updateRecordsInfo(result.pagination);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error loading general ledger:', error);
            this.showError();
            this.showToast('Error loading general ledger entries', 'error');
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }
    
    async loadStatistics() {
        try {
            const response = await fetch('/api/general-ledger/stats');
            const result = await response.json();
            
            if (result.success) {
                this.updateStatistics(result.data);
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }
    
    updateStatistics(stats) {
        const elements = {
            'glTotalEntries': stats.totalEntries,
            'glPendingEntries': stats.pendingEntries,
            'glLockedEntries': stats.lockedEntries,
            'glRecentEntries': stats.recentEntries
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value.toLocaleString();
            }
        });
    }
    
    renderTable() {
        const tbody = document.getElementById('glTableBody');
        if (!tbody) return;
        
        const table = document.getElementById('glTable');
        
        if (this.allEntries.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="29" style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 14px; margin-bottom: 12px;">
                            No general ledger entries found
                        </div>
                        <button class="btn btn-primary" onclick="glManager.showAddModal()">
                            Add First Entry
                        </button>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.allEntries.map(entry => this.renderTableRow(entry)).join('');
        
        if (table) {
            table.style.display = 'table';
        }
    }
    
    renderTableRow(entry) {
        return `
            <tr>
                <td title="ID: ${entry.id}">${entry.id}</td>
                <td title="Transaction Date">${this.formatDate(entry.transaction_date)}</td>
                <td class="jv-number" title="Journal Voucher: ${entry.jv_number}">${entry.jv_number}</td>
                <td title="Year Period">${entry.year_period}</td>
                <td title="Batch Number">${entry.batch_number || '<span class="empty-cell">-</span>'}</td>
                <td title="Batch Sequence">${entry.batch_sequence || '<span class="empty-cell">-</span>'}</td>
                <td title="Transaction Type">${entry.transaction_type || '<span class="empty-cell">-</span>'}</td>
                <td title="Type Sequence">${entry.type_sequence || '<span class="empty-cell">-</span>'}</td>
                <td class="account-number" title="Account: ${entry.account_number}">${entry.account_number}</td>
                <td title="Auxiliary Account">${entry.auxiliary_account || '<span class="empty-cell">-</span>'}</td>
                <td title="Account Name" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">
                    ${entry.account_name || '<span class="empty-cell">-</span>'}
                </td>
                <td title="Cost Center 2">${entry.cc2 || '<span class="empty-cell">-</span>'}</td>
                <td title="Shipment">${entry.shipment || '<span class="empty-cell">-</span>'}</td>
                <td title="Document Reference">${entry.doc_ref || '<span class="empty-cell">-</span>'}</td>
                <td title="Document Date">${this.formatDate(entry.doc_date) || '<span class="empty-cell">-</span>'}</td>
                <td title="M Classification">${entry.m_classification || '<span class="empty-cell">-</span>'}</td>
                <td title="Description: ${entry.description || 'No description'}" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                    ${this.truncateText(entry.description, 50) || '<span class="empty-cell">-</span>'}
                </td>
                <td title="${this.getDebitCreditText(entry.debit_credit)}" 
                    style="text-align: center; font-weight: bold; color: ${entry.debit_credit === 'D' ? '#008000' : '#cc0000'};">
                    ${entry.debit_credit || '-'}
                </td>
                <td title="Currency">${entry.currency_code}</td>
                <td class="amount" title="Foreign Amount">${this.formatAmount(entry.foreign_amount)}</td>
                <td class="amount ${entry.debit_credit === 'D' ? 'debit' : 'credit'}" title="AED Amount">
                    ${this.formatAmount(entry.aed_amount)}
                </td>
                <td class="amount ${entry.debit_credit === 'D' ? 'debit' : 'credit'}" title="USD Amount">
                    ${this.formatAmount(entry.usd_amount)}
                </td>
                <td title="Pending Status" style="text-align: center;">
                    ${entry.is_pending ? '<span class="status-pending">PENDING</span>' : '-'}
                </td>
                <td title="Locked Status" style="text-align: center;">
                    ${entry.is_locked ? '<span class="status-locked">LOCKED</span>' : '-'}
                </td>
                <td title="Created By">${entry.created_by || 'N/A'}</td>
                <td title="Created On: ${this.formatDateTime(entry.created_on)}">${this.formatDate(entry.created_on)}</td>
                <td title="Updated By">${entry.updated_by || 'N/A'}</td>
                <td title="Updated On: ${this.formatDateTime(entry.updated_on)}">${this.formatDate(entry.updated_on)}</td>
                <td style="text-align: center;">
                    <button class="btn-edit" onclick="glManager.editEntry(${entry.id})" 
                            title="Edit Entry" ${entry.is_locked ? 'disabled' : ''}>
                        Edit
                    </button>
                    <button class="btn-delete" onclick="glManager.deleteEntry(${entry.id})" 
                            title="Delete Entry" ${entry.is_locked ? 'disabled' : ''}>
                        Del
                    </button>
                </td>
            </tr>
        `;
    }
    
    handleSearch(searchTerm) {
        const clearBtn = document.getElementById('clearGLSearch');
        
        if (searchTerm.trim()) {
            if (clearBtn) clearBtn.style.display = 'inline-block';
            this.showFilterInfo(`Search: "${searchTerm}"`);
        } else {
            if (clearBtn) clearBtn.style.display = 'none';
            this.hideFilterInfo();
        }
        
        this.currentPage = 1;
        this.loadGeneralLedger();
    }
    
    applyFilters() {
        this.currentFilters = {
            account: document.getElementById('glFilterAccount')?.value || '',
            dateFrom: document.getElementById('glFilterDateFrom')?.value || '',
            dateTo: document.getElementById('glFilterDateTo')?.value || '',
            jvNumber: document.getElementById('glFilterJV')?.value || '',
            currency: document.getElementById('glFilterCurrency')?.value || '',
            debitCredit: document.getElementById('glFilterDC')?.value || '',
            pendingOnly: document.getElementById('glFilterPending')?.checked || false
        };
        
        this.currentPage = 1;
        this.loadGeneralLedger();
        
        // Update filter info
        const activeFilters = [];
        if (this.currentFilters.account) activeFilters.push('Account');
        if (this.currentFilters.dateFrom) activeFilters.push('Date From');
        if (this.currentFilters.dateTo) activeFilters.push('Date To');
        if (this.currentFilters.jvNumber) activeFilters.push('JV#');
        if (this.currentFilters.currency) activeFilters.push('Currency');
        if (this.currentFilters.debitCredit) activeFilters.push('D/C');
        if (this.currentFilters.pendingOnly) activeFilters.push('Pending');
        
        if (activeFilters.length > 0) {
            this.showFilterInfo(`Filters: ${activeFilters.join(', ')}`);
        } else {
            this.hideFilterInfo();
        }
    }
    
    clearFilters() {
        const filterIds = [
            'glFilterAccount', 'glFilterDateFrom', 'glFilterDateTo', 
            'glFilterJV', 'glFilterCurrency', 'glFilterDC'
        ];
        
        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
        
        const pendingCheckbox = document.getElementById('glFilterPending');
        if (pendingCheckbox) pendingCheckbox.checked = false;
        
        this.applyFilters();
    }
    
    toggleFilters() {
        const filterPanel = document.getElementById('glFilterPanel');
        const toggleBtn = document.getElementById('glFilterToggle');
        
        if (filterPanel && toggleBtn) {
            if (filterPanel.classList.contains('active')) {
                filterPanel.classList.remove('active');
                toggleBtn.textContent = 'Filters';
            } else {
                filterPanel.classList.add('active');
                toggleBtn.textContent = 'Hide Filters';
            }
        }
    }
    
    sortTable(column) {
        if (this.currentSort.column === column) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.column = column;
            this.currentSort.direction = 'asc';
        }
        
        // Visual indicators would be handled by CSS
        this.loadGeneralLedger();
    }
    
    goToPage(page) {
        if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
            this.currentPage = page;
            this.loadGeneralLedger();
        }
    }
    
    updatePagination() {
        const pagination = document.getElementById('glPagination');
        if (!pagination) return;
        
        if (this.totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'flex';
        
        // Update button states
        const buttons = {
            'glFirstBtn': this.currentPage === 1,
            'glPrevBtn': this.currentPage === 1,
            'glNextBtn': this.currentPage === this.totalPages,
            'glLastBtn': this.currentPage === this.totalPages
        };
        
        Object.entries(buttons).forEach(([id, disabled]) => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = disabled;
        });
        
        // Update page info
        const pageInfo = document.getElementById('glPageInfo');
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        }
    }
    
    updateRecordsInfo(pagination) {
        const recordsInfo = document.getElementById('glRecordsInfo');
        if (!recordsInfo) return;
        
        if (pagination.totalPages > 1) {
            recordsInfo.textContent = 
                `Page ${pagination.currentPage} of ${pagination.totalPages} (${pagination.totalRecords.toLocaleString()} records)`;
        } else {
            recordsInfo.textContent = `${pagination.totalRecords.toLocaleString()} records`;
        }
    }
    
    // Modal Management
    showAddModal() {
        this.clearForm();
        this.setDefaultValues();
        
        const modal = document.getElementById('glEntryModal');
        const title = document.getElementById('glModalTitle');
        const saveBtn = document.getElementById('glSaveBtn');
        
        if (title) title.textContent = 'Add New General Ledger Entry';
        if (saveBtn) saveBtn.textContent = 'Save Entry';
        if (modal) {
            modal.style.display = 'block';
            modal.dataset.mode = 'add';
        }
        
        document.body.style.overflow = 'hidden';
    }
    
    editEntry(id) {
        const entry = this.allEntries.find(e => e.id === id);
        if (!entry) return;
        
        if (entry.is_locked) {
            this.showToast('Cannot edit locked entry', 'warning');
            return;
        }
        
        this.fillForm(entry);
        
        const modal = document.getElementById('glEntryModal');
        const title = document.getElementById('glModalTitle');
        const saveBtn = document.getElementById('glSaveBtn');
        
        if (title) title.textContent = 'Edit General Ledger Entry';
        if (saveBtn) saveBtn.textContent = 'Update Entry';
        if (modal) {
            modal.style.display = 'block';
            modal.dataset.mode = 'edit';
            modal.dataset.entryId = id;
        }
        
        document.body.style.overflow = 'hidden';
    }
    
    clearForm() {
        const form = document.getElementById('glEntryForm');
        if (form) {
            form.reset();
        }
    }
    
    fillForm(entry) {
        const fieldMappings = {
            'glTransactionDate': entry.transaction_date,
            'glJvNumber': entry.jv_number,
            'glYearPeriod': entry.year_period,
            'glBatchNumber': entry.batch_number,
            'glBatchSequence': entry.batch_sequence,
            'glTransactionType': entry.transaction_type,
            'glTypeSequence': entry.type_sequence,
            'glAccountNumber': entry.account_number,
            'glAccountName': entry.account_name,
            'glAuxiliaryAccount': entry.auxiliary_account,
            'glCc2': entry.cc2,
            'glShipment': entry.shipment,
            'glDocRef': entry.doc_ref,
            'glDocDate': entry.doc_date,
            'glMClassification': entry.m_classification,
            'glDescription': entry.description,
            'glDebitCredit': entry.debit_credit,
            'glCurrencyCode': entry.currency_code,
            'glForeignAmount': entry.foreign_amount,
            'glAedAmount': entry.aed_amount,
            'glUsdAmount': entry.usd_amount,
            'glCreatedBy': entry.updated_by || entry.created_by
        };
        
        Object.entries(fieldMappings).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value || '';
            }
        });
        
        // Handle checkboxes
        const pendingCheckbox = document.getElementById('glIsPending');
        const lockedCheckbox = document.getElementById('glIsLocked');
        
        if (pendingCheckbox) pendingCheckbox.checked = entry.is_pending || false;
        if (lockedCheckbox) lockedCheckbox.checked = entry.is_locked || false;
        
        // Update amount styles
        this.updateAmountStyles();
    }
    
    closeModal() {
        const modal = document.getElementById('glEntryModal');
        if (modal) {
            modal.style.display = 'none';
            modal.removeAttribute('data-mode');
            modal.removeAttribute('data-entry-id');
        }
        
        document.body.style.overflow = 'auto';
        this.clearForm();
    }
    
    updateAccountName() {
        const accountSelect = document.getElementById('glAccountNumber');
        const accountNameInput = document.getElementById('glAccountName');
        
        if (!accountSelect || !accountNameInput) return;
        
        const selectedAccount = this.accounts.find(acc => acc.pts_account_no === accountSelect.value);
        accountNameInput.value = selectedAccount ? (selectedAccount.name || '') : '';
    }
    
    calculateAmounts() {
        const currencySelect = document.getElementById('glCurrencyCode');
        const foreignAmountInput = document.getElementById('glForeignAmount');
        const aedAmountInput = document.getElementById('glAedAmount');
        const usdAmountInput = document.getElementById('glUsdAmount');
        
        if (!currencySelect || !foreignAmountInput || !aedAmountInput || !usdAmountInput) return;
        
        const currency = currencySelect.value;
        const foreignAmount = parseFloat(foreignAmountInput.value) || 0;
        
        if (currency === 'AED') {
            aedAmountInput.value = foreignAmount.toFixed(2);
            usdAmountInput.value = (foreignAmount / this.exchangeRates.USD).toFixed(2);
        } else if (currency === 'USD') {
            usdAmountInput.value = foreignAmount.toFixed(2);
            aedAmountInput.value = (foreignAmount * this.exchangeRates.USD).toFixed(2);
        } else {
            const rate = this.exchangeRates[currency] || 1;
            aedAmountInput.value = (foreignAmount * rate).toFixed(2);
            usdAmountInput.value = (foreignAmount * rate / this.exchangeRates.USD).toFixed(2);
        }
    }
    
    updateAmountStyles() {
        const dcSelect = document.getElementById('glDebitCredit');
        if (!dcSelect) return;
        
        const amountInputs = document.querySelectorAll('.gl-amount-input');
        const dcValue = dcSelect.value;
        
        amountInputs.forEach(input => {
            input.classList.remove('debit', 'credit');
            if (dcValue === 'D') {
                input.classList.add('debit');
            } else if (dcValue === 'C') {
                input.classList.add('credit');
            }
        });
    }
    
    async handleFormSubmit() {
        const formData = this.getFormData();
        
        if (!this.validateForm(formData)) {
            return;
        }
        
        const modal = document.getElementById('glEntryModal');
        const isEdit = modal && modal.dataset.mode === 'edit';
        const entryId = isEdit ? modal.dataset.entryId : null;
        
        try {
            const url = isEdit ? `/api/general-ledger/${entryId}` : '/api/general-ledger';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(
                    isEdit ? 'Entry updated successfully!' : 'Entry created successfully!', 
                    'success'
                );
                this.closeModal();
                this.loadGeneralLedger();
                this.loadStatistics();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error saving entry:', error);
            this.showToast(`Error saving entry: ${error.message}`, 'error');
        }
    }
    
    getFormData() {
        return {
            transaction_date: document.getElementById('glTransactionDate')?.value || null,
            jv_number: document.getElementById('glJvNumber')?.value || null,
            year_period: parseInt(document.getElementById('glYearPeriod')?.value) || null,
            batch_number: document.getElementById('glBatchNumber')?.value || null,
            batch_sequence: parseInt(document.getElementById('glBatchSequence')?.value) || null,
            transaction_type: document.getElementById('glTransactionType')?.value || null,
            type_sequence: parseInt(document.getElementById('glTypeSequence')?.value) || null,
            account_number: document.getElementById('glAccountNumber')?.value || null,
            auxiliary_account: document.getElementById('glAuxiliaryAccount')?.value || null,
            account_name: document.getElementById('glAccountName')?.value || null,
            cc2: document.getElementById('glCc2')?.value || null,
            shipment: document.getElementById('glShipment')?.value || null,
            doc_ref: document.getElementById('glDocRef')?.value || null,
            doc_date: document.getElementById('glDocDate')?.value || null,
            m_classification: document.getElementById('glMClassification')?.value || null,
            description: document.getElementById('glDescription')?.value || null,
            debit_credit: document.getElementById('glDebitCredit')?.value || null,
            currency_code: document.getElementById('glCurrencyCode')?.value || 'AED',
            foreign_amount: parseFloat(document.getElementById('glForeignAmount')?.value) || null,
            aed_amount: parseFloat(document.getElementById('glAedAmount')?.value) || null,
            usd_amount: parseFloat(document.getElementById('glUsdAmount')?.value) || null,
            is_pending: document.getElementById('glIsPending')?.checked || false,
            is_locked: document.getElementById('glIsLocked')?.checked || false,
            created_by: document.getElementById('glCreatedBy')?.value || 'USER'
        };
    }
    
    validateForm(formData) {
        const requiredFields = [
            { field: 'transaction_date', name: 'Transaction Date' },
            { field: 'jv_number', name: 'JV Number' },
            { field: 'year_period', name: 'Year Period' },
            { field: 'account_number', name: 'Account Number' }
        ];
        
        for (const { field, name } of requiredFields) {
            if (!formData[field]) {
                this.showToast(`${name} is required`, 'error');
                const element = document.getElementById('gl' + field.charAt(0).toUpperCase() + field.slice(1).replace(/_([a-z])/g, (g) => g[1].toUpperCase()));
                if (element) element.focus();
                return false;
            }
        }
        
        // Validate JV number format
        if (formData.jv_number && formData.jv_number.length > 50) {
            this.showToast('JV Number is too long (maximum 50 characters)', 'error');
            return false;
        }
        
        // Validate year period
        if (formData.year_period && (formData.year_period < 2000 || formData.year_period > 2099)) {
            this.showToast('Year Period must be between 2000 and 2099', 'error');
            return false;
        }
        
        // Validate amounts
        if (formData.foreign_amount && formData.foreign_amount < 0) {
            this.showToast('Amounts cannot be negative', 'error');
            return false;
        }
        
        return true;
    }
    
    async deleteEntry(id) {
        const entry = this.allEntries.find(e => e.id === id);
        if (!entry) return;
        
        if (entry.is_locked) {
            this.showToast('Cannot delete locked entry', 'warning');
            return;
        }
        
        const confirmMessage = `Are you sure you want to delete entry ${entry.jv_number}?\n\nThis action cannot be undone.`;
        
        if (confirm(confirmMessage)) {
            try {
                const response = await fetch(`/api/general-ledger/${id}`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    this.showToast('Entry deleted successfully!', 'success');
                    this.loadGeneralLedger();
                    this.loadStatistics();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('Error deleting entry:', error);
                this.showToast(`Error deleting entry: ${error.message}`, 'error');
            }
        }
    }
    
    exportToCSV() {
        if (this.allEntries.length === 0) {
            this.showToast('No data to export', 'warning');
            return;
        }
        
        const headers = [
            'ID', 'Date', 'JV#', 'Year', 'Batch', 'Batch Seq', 'Type', 'Type Seq',
            'Account', 'Auxiliary', 'Name', 'CC2', 'Shipment', 'Doc Ref', 'Doc Date',
            'M', 'Description', 'D/C', 'Currency', 'Foreign', 'AED', 'USD',
            'Pending', 'Locked', 'Created By', 'Created On', 'Updated By', 'Updated On'
        ];
        
        const csvContent = [
            headers.join(','),
            ...this.allEntries.map(entry => [
                entry.id,
                entry.transaction_date,
                `"${entry.jv_number}"`,
                entry.year_period,
                `"${entry.batch_number || ''}"`,
                entry.batch_sequence || '',
                `"${entry.transaction_type || ''}"`,
                entry.type_sequence || '',
                entry.account_number,
                `"${entry.auxiliary_account || ''}"`,
                `"${(entry.account_name || '').replace(/"/g, '""')}"`,
                `"${entry.cc2 || ''}"`,
                `"${entry.shipment || ''}"`,
                `"${entry.doc_ref || ''}"`,
                entry.doc_date || '',
                `"${entry.m_classification || ''}"`,
                `"${(entry.description || '').replace(/"/g, '""')}"`,
                entry.debit_credit || '',
                entry.currency_code,
                entry.foreign_amount || '',
                entry.aed_amount || '',
                entry.usd_amount || '',
                entry.is_pending ? 'Yes' : 'No',
                entry.is_locked ? 'Yes' : 'No',
                entry.created_by || '',
                entry.created_on || '',
                entry.updated_by || '',
                entry.updated_on || ''
            ].join(','))
        ].join('\n');
        
        const filename = `general_ledger_${new Date().toISOString().split('T')[0]}.csv`;
        this.downloadFile(csvContent, filename, 'text/csv');
        this.showToast(`Exported ${this.allEntries.length} entries successfully!`, 'success');
    }
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
    
    refreshData() {
        this.loadGeneralLedger();
        this.loadStatistics();
        this.showToast('Data refreshed', 'success');
    }
    
    // UI Helper Methods
    showLoading(show) {
        const loading = document.getElementById('glLoading');
        const tableWrapper = document.querySelector('.gl-table-wrapper');
        
        if (loading) loading.style.display = show ? 'flex' : 'none';
        if (tableWrapper) tableWrapper.style.display = show ? 'none' : 'block';
    }
    
    showError() {
        const error = document.getElementById('glError');
        const tableWrapper = document.querySelector('.gl-table-wrapper');
        
        if (error) error.style.display = 'flex';
        if (tableWrapper) tableWrapper.style.display = 'none';
    }
    
    hideError() {
        const error = document.getElementById('glError');
        if (error) error.style.display = 'none';
    }
    
    showFilterInfo(text) {
        const filterInfo = document.getElementById('glFilterInfo');
        if (filterInfo) {
            filterInfo.textContent = text;
            filterInfo.style.display = 'inline';
        }
    }
    
    hideFilterInfo() {
        const filterInfo = document.getElementById('glFilterInfo');
        if (filterInfo) filterInfo.style.display = 'none';
    }
    
    showToast(message, type = 'info') {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('glToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'glToast';
            toast.className = 'gl-toast';
            toast.innerHTML = `
                <div class="gl-toast-content">
                    <span class="gl-toast-message"></span>
                    <button class="gl-toast-close" onclick="this.parentElement.parentElement.style.display='none'">&times;</button>
                </div>
            `;
            document.body.appendChild(toast);
        }
        
        const messageEl = toast.querySelector('.gl-toast-message');
        if (messageEl) messageEl.textContent = message;
        
        toast.className = `gl-toast gl-toast-${type}`;
        toast.style.display = 'block';
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
    }
    
    // Utility Methods
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    }
    
    formatDateTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    formatAmount(amount) {
        if (amount === null || amount === undefined || amount === '') return '';
        return parseFloat(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    getDebitCreditText(dc) {
        if (dc === 'D') return 'Debit';
        if (dc === 'C') return 'Credit';
        return '';
    }
}

// Initialize General Ledger Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the General Ledger page
    if (document.getElementById('glTable') || document.getElementById('glEntryModal')) {
        window.glManager = new GeneralLedgerManager();
        
        // Global functions for onclick handlers
        window.glShowAddModal = () => window.glManager.showAddModal();
        window.glEditEntry = (id) => window.glManager.editEntry(id);
        window.glDeleteEntry = (id) => window.glManager.deleteEntry(id);
        window.glCloseModal = () => window.glManager.closeModal();
        window.glRefreshData = () => window.glManager.refreshData();
        window.glExportData = () => window.glManager.exportToCSV();
        window.glClearSearch = () => window.glManager.handleSearch('');
        window.glToggleFilters = () => window.glManager.toggleFilters();
        window.glApplyFilters = () => window.glManager.applyFilters();
        window.glClearFilters = () => window.glManager.clearFilters();
        window.glSortTable = (column) => window.glManager.sortTable(column);
        window.glGoToPage = (page) => window.glManager.goToPage(page);
        window.glUpdateAccountName = () => window.glManager.updateAccountName();
        window.glCalculateAmounts = () => window.glManager.calculateAmounts();
        window.glUpdateAmountStyles = () => window.glManager.updateAmountStyles();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Only if General Ledger page is active
    if (window.glManager) {
        // Ctrl+N for new entry
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            window.glManager.showAddModal();
        }
        
        // Ctrl+R for refresh
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            window.glManager.refreshData();
        }
        
        // Ctrl+E for export
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            window.glManager.exportToCSV();
        }
        
        // Ctrl+F for search focus
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('glSearchInput');
            if (searchInput) searchInput.focus();
        }
    }
});

// Export the class for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeneralLedgerManager;
}