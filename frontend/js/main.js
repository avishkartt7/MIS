// =====================================================
// MIS SYSTEM - TRADITIONAL TABLE UI JAVASCRIPT
// Complete Chart of Accounts Management
// =====================================================

class ChartOfAccountsManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 50;
        this.allAccounts = [];
        this.filteredAccounts = [];
        this.searchTimeout = null;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadAccounts();
    }
    
    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.handleSearch(e.target.value);
            }, 300);
        });
        
        // Clear search
        document.getElementById('clearSearch').addEventListener('click', () => {
            searchInput.value = '';
            this.handleSearch('');
        });
        
        // Records per page
        document.getElementById('recordsPerPage').addEventListener('change', (e) => {
            this.itemsPerPage = e.target.value === 'all' ? this.filteredAccounts.length : parseInt(e.target.value);
            this.currentPage = 1;
            this.renderTable();
        });
        
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadAccounts();
        });
        
        // Header action buttons
        document.getElementById('downloadSampleBtn').addEventListener('click', () => {
            this.downloadSampleCSV();
        });
        
        document.getElementById('importBtn').addEventListener('click', () => {
            this.showImportModal();
        });
        
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportToCSV();
        });
        
        document.getElementById('addNewBtn').addEventListener('click', () => {
            this.showAccountModal();
        });
        
        // Modal events
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeAccountModal();
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeAccountModal();
        });
        
        document.getElementById('closeImportModal').addEventListener('click', () => {
            this.closeImportModal();
        });
        
        document.getElementById('cancelImportBtn').addEventListener('click', () => {
            this.closeImportModal();
        });
        
        // Form submission
        document.getElementById('accountForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });
        
        // File import
        document.getElementById('selectFileBtn').addEventListener('click', () => {
            document.getElementById('csvFile').click();
        });
        
        document.getElementById('csvFile').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });
        
        document.getElementById('removeFile').addEventListener('click', () => {
            this.clearFileSelection();
        });
        
        document.getElementById('importDataBtn').addEventListener('click', () => {
            this.handleImport();
        });
        
        // Table sorting
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                this.handleSort(th.dataset.sort);
            });
        });
        
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                if (e.target.id === 'accountModal') this.closeAccountModal();
                if (e.target.id === 'importModal') this.closeImportModal();
            }
        });
        
        // Toast close
        document.querySelector('.toast-close').addEventListener('click', () => {
            this.hideToast();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAccountModal();
                this.closeImportModal();
            }
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                searchInput.focus();
            }
        });
    }
    
    async loadAccounts() {
        this.showLoading(true);
        this.hideError();
        
        try {
            const response = await fetch('/api/accounts');
            const result = await response.json();
            
            if (result.success) {
                this.allAccounts = result.data;
                this.filteredAccounts = [...this.allAccounts];
                this.currentPage = 1;
                this.renderTable();
                this.showLoading(false);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
            this.showError();
            this.showLoading(false);
        }
    }
    
    handleSearch(searchTerm) {
        const clearBtn = document.getElementById('clearSearch');
        
        if (!searchTerm.trim()) {
            this.filteredAccounts = [...this.allAccounts];
            clearBtn.style.display = 'none';
            this.hideFilterInfo();
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredAccounts = this.allAccounts.filter(account => 
                account.pts_account_no.toLowerCase().includes(term) ||
                (account.name && account.name.toLowerCase().includes(term)) ||
                (account.short_name && account.short_name.toLowerCase().includes(term))
            );
            clearBtn.style.display = 'block';
            this.showFilterInfo(searchTerm);
        }
        
        this.currentPage = 1;
        this.renderTable();
    }
    
    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        // Update sort indicators
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
        });
        
        const currentTh = document.querySelector(`[data-sort="${column}"]`);
        currentTh.classList.add(`sorted-${this.sortDirection}`);
        
        // Sort the data
        this.filteredAccounts.sort((a, b) => {
            let aVal = a[column] || '';
            let bVal = b[column] || '';
            
            // Handle numeric sorting for account numbers
            if (column === 'pts_account_no') {
                aVal = parseInt(aVal) || 0;
                bVal = parseInt(bVal) || 0;
            } else {
                aVal = aVal.toString().toLowerCase();
                bVal = bVal.toString().toLowerCase();
            }
            
            if (this.sortDirection === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });
        
        this.renderTable();
    }
    
    renderTable() {
        const tbody = document.getElementById('accountsTableBody');
        const table = document.getElementById('accountsTable');
        
        if (this.filteredAccounts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: #7f8c8d; font-style: italic;">
                        <i class="fas fa-inbox" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                        No accounts found matching your criteria
                    </td>
                </tr>
            `;
            table.style.display = 'table';
            this.updateTableInfo();
            return;
        }
        
        const totalItems = this.filteredAccounts.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        // Adjust current page if necessary
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages || 1;
        }
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
        const pageAccounts = this.filteredAccounts.slice(startIndex, endIndex);
        
        tbody.innerHTML = pageAccounts.map(account => `
            <tr>
                <td>
                    <span class="account-number">${account.pts_account_no}</span>
                </td>
                <td>
                    <div class="account-name ${!account.name ? 'empty' : ''}" title="${account.name || 'Not set'}">
                        ${account.name || 'Not set'}
                    </div>
                </td>
                <td>
                    <div class="account-name ${!account.short_name ? 'empty' : ''}" title="${account.short_name || 'Not set'}">
                        ${account.short_name || 'Not set'}
                    </div>
                </td>
                <td>
                    ${this.getAccountType(account.pts_account_no)}
                </td>
                <td>
                    ${account.acc_type_code_debit ? 
                        `<span class="account-code">${account.acc_type_code_debit}</span>` : 
                        '<span class="account-name empty">Not set</span>'
                    }
                </td>
                <td>
                    ${account.acc_type_code_credit ? 
                        `<span class="account-code">${account.acc_type_code_credit}</span>` : 
                        '<span class="account-name empty">Not set</span>'
                    }
                </td>
                <td>
                    <div class="created-info">${account.created_by || 'N/A'}</div>
                </td>
                <td>
                    <div class="date-info">${this.formatDate(account.created_on)}</div>
                </td>
                <td>
                    <div class="date-info">${this.formatDate(account.updated_on)}</div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-edit" onclick="coaManager.editAccount('${account.pts_account_no}')" title="Edit Account">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-delete" onclick="coaManager.deleteAccount('${account.pts_account_no}')" title="Delete Account">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        table.style.display = 'table';
        this.updateTableInfo();
        this.updatePagination();
    }
    
    getAccountType(accountNo) {
        const firstDigit = accountNo.charAt(0);
        const types = {
            '1': 'Asset',
            '2': 'Liability', 
            '3': 'Equity',
            '4': 'Revenue',
            '5': 'Cost of Sales',
            '6': 'Expense',
            '9': 'Other'
        };
        
        const type = types[firstDigit] || 'Unknown';
        return `<span class="account-type">${type}</span>`;
    }
    
    updateTableInfo() {
        const recordsInfo = document.getElementById('recordsInfo');
        const total = this.allAccounts.length;
        const filtered = this.filteredAccounts.length;
        
        if (filtered === total) {
            recordsInfo.textContent = `Showing ${filtered.toLocaleString()} records`;
        } else {
            recordsInfo.textContent = `Showing ${filtered.toLocaleString()} of ${total.toLocaleString()} records`;
        }
    }
    
    showFilterInfo(searchTerm) {
        const filterInfo = document.getElementById('filterInfo');
        filterInfo.textContent = `Filtered by: "${searchTerm}"`;
        filterInfo.style.display = 'inline';
    }
    
    hideFilterInfo() {
        document.getElementById('filterInfo').style.display = 'none';
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.filteredAccounts.length / this.itemsPerPage);
        const pagination = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'flex';
        
        // Update navigation buttons
        document.getElementById('firstBtn').disabled = this.currentPage === 1;
        document.getElementById('prevBtn').disabled = this.currentPage === 1;
        document.getElementById('nextBtn').disabled = this.currentPage === totalPages;
        document.getElementById('lastBtn').disabled = this.currentPage === totalPages;
        
        // Update page buttons
        this.renderPaginationPages(totalPages);
        
        // Bind navigation events
        this.bindPaginationEvents(totalPages);
    }
    
    renderPaginationPages(totalPages) {
        const paginationPages = document.getElementById('paginationPages');
        const maxVisiblePages = 7;
        let startPage, endPage;
        
        if (totalPages <= maxVisiblePages) {
            startPage = 1;
            endPage = totalPages;
        } else {
            const halfVisible = Math.floor(maxVisiblePages / 2);
            if (this.currentPage <= halfVisible) {
                startPage = 1;
                endPage = maxVisiblePages;
            } else if (this.currentPage + halfVisible >= totalPages) {
                startPage = totalPages - maxVisiblePages + 1;
                endPage = totalPages;
            } else {
                startPage = this.currentPage - halfVisible;
                endPage = this.currentPage + halfVisible;
            }
        }
        
        let pagesHTML = '';
        
        for (let i = startPage; i <= endPage; i++) {
            pagesHTML += `
                <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                        data-page="${i}">${i}</button>
            `;
        }
        
        if (startPage > 1) {
            pagesHTML = `<span style="margin: 0 8px;">...</span>` + pagesHTML;
        }
        if (endPage < totalPages) {
            pagesHTML += `<span style="margin: 0 8px;">...</span>`;
        }
        
        paginationPages.innerHTML = pagesHTML;
    }
    
    bindPaginationEvents(totalPages) {
        document.getElementById('firstBtn').onclick = () => this.goToPage(1);
        document.getElementById('prevBtn').onclick = () => this.goToPage(Math.max(1, this.currentPage - 1));
        document.getElementById('nextBtn').onclick = () => this.goToPage(Math.min(totalPages, this.currentPage + 1));
        document.getElementById('lastBtn').onclick = () => this.goToPage(totalPages);
        
        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.onclick = () => this.goToPage(parseInt(btn.dataset.page));
        });
    }
    
    goToPage(page) {
        this.currentPage = page;
        this.renderTable();
    }
    
    // Modal Management
    showAccountModal(account = null) {
        const modal = document.getElementById('accountModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('accountForm');
        
        if (account) {
            title.textContent = 'Edit Account';
            this.fillForm(account);
            document.getElementById('ptsAccountNo').readOnly = true;
            document.getElementById('saveBtnText').textContent = 'Update Account';
        } else {
            title.textContent = 'Add New Account';
            form.reset();
            document.getElementById('ptsAccountNo').readOnly = false;
            document.getElementById('saveBtnText').textContent = 'Save Account';
        }
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        document.getElementById('ptsAccountNo').focus();
    }
    
    closeAccountModal() {
        document.getElementById('accountModal').style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('accountForm').reset();
    }
    
    fillForm(account) {
        document.getElementById('ptsAccountNo').value = account.pts_account_no;
        document.getElementById('accountName').value = account.name || '';
        document.getElementById('shortName').value = account.short_name || '';
        document.getElementById('debitCode').value = account.acc_type_code_debit || '';
        document.getElementById('creditCode').value = account.acc_type_code_credit || '';
        
        // Set account type based on first digit
        const firstDigit = account.pts_account_no.charAt(0);
        const typeMap = {
            '1': 'Asset', '2': 'Liability', '3': 'Equity',
            '4': 'Revenue', '5': 'Cost of Sales', '6': 'Expense', '9': 'Other'
        };
        document.getElementById('accountType').value = typeMap[firstDigit] || '';
    }
    
    async handleFormSubmit() {
        const formData = this.getFormData();
        const isEdit = document.getElementById('ptsAccountNo').readOnly;
        
        if (!this.validateForm(formData)) {
            return;
        }
        
        try {
            const url = isEdit ? `/api/accounts/${formData.pts_account_no}` : '/api/accounts';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.accountName,
                    short_name: formData.shortName,
                    acc_type_code_debit: formData.debitCode,
                    acc_type_code_credit: formData.creditCode
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(isEdit ? 'Account updated successfully!' : 'Account created successfully!', 'success');
                this.closeAccountModal();
                this.loadAccounts();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error saving account:', error);
            this.showToast('Error saving account. Please try again.', 'error');
        }
    }
    
    getFormData() {
        return {
            pts_account_no: document.getElementById('ptsAccountNo').value.trim(),
            accountName: document.getElementById('accountName').value.trim(),
            shortName: document.getElementById('shortName').value.trim(),
            accountType: document.getElementById('accountType').value,
            debitCode: document.getElementById('debitCode').value.trim(),
            creditCode: document.getElementById('creditCode').value.trim()
        };
    }
    
    validateForm(formData) {
        if (!formData.pts_account_no) {
            this.showToast('Account number is required', 'error');
            return false;
        }
        
        if (!formData.accountName) {
            this.showToast('Account name is required', 'error');
            return false;
        }
        
        // Check length limits
        if (formData.accountName.length > 500) {
            this.showToast('Account name is too long (maximum 500 characters)', 'error');
            return false;
        }
        
        if (formData.shortName.length > 150) {
            this.showToast('Short name is too long (maximum 150 characters)', 'error');
            return false;
        }
        
        if (formData.debitCode.length > 50) {
            this.showToast('Debit code is too long (maximum 50 characters)', 'error');
            return false;
        }
        
        if (formData.creditCode.length > 50) {
            this.showToast('Credit code is too long (maximum 50 characters)', 'error');
            return false;
        }
        
        return true;
    }
    
    editAccount(ptsAccountNo) {
        const account = this.allAccounts.find(acc => acc.pts_account_no === ptsAccountNo);
        if (account) {
            this.showAccountModal(account);
        }
    }
    
    deleteAccount(ptsAccountNo) {
        if (confirm(`Are you sure you want to delete account ${ptsAccountNo}?`)) {
            // Implement delete functionality
            this.showToast('Delete functionality not implemented yet', 'warning');
        }
    }
    
    // Import/Export Functions
    downloadSampleCSV() {
        const sampleData = this.generateSampleData();
        const headers = ['PTS Account No', 'Account Name', 'Short Name', 'Debit Code', 'Credit Code'];
        const csvContent = [
            headers.join(','),
            ...sampleData.map(row => [
                row.pts_account_no,
                `"${row.name}"`,
                `"${row.short_name || ''}"`,
                row.acc_type_code_debit || '',
                row.acc_type_code_credit || ''
            ].join(','))
        ].join('\n');
        
        this.downloadFile(csvContent, 'sample_chart_of_accounts.csv', 'text/csv');
        this.showToast('Sample CSV downloaded successfully!', 'success');
    }
    
    generateSampleData() {
        return [
            {
                pts_account_no: '110101',
                name: 'Cash at Bank - Main Account',
                short_name: 'Cash-Main',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '110102',
                name: 'Cash at Bank - Petty Cash',
                short_name: 'Petty Cash',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '111101',
                name: 'Trade Receivables',
                short_name: 'AR',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '111102',
                name: 'Advances to Suppliers',
                short_name: 'Adv-Suppliers',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '120101',
                name: 'Property, Plant & Equipment',
                short_name: 'PPE',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '210101',
                name: 'Trade Payables',
                short_name: 'AP',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '210102',
                name: 'Accrued Expenses',
                short_name: 'Accruals',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '310101',
                name: 'Share Capital',
                short_name: 'Capital',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '410101',
                name: 'Construction Revenue',
                short_name: 'Revenue',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '510101',
                name: 'Direct Materials',
                short_name: 'Materials',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '510102',
                name: 'Direct Labor',
                short_name: 'Labor',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '610101',
                name: 'Office Rent',
                short_name: 'Rent',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '610102',
                name: 'Utilities Expense',
                short_name: 'Utilities',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '650101',
                name: 'Marketing & Advertising',
                short_name: 'Marketing',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            },
            {
                pts_account_no: '650102',
                name: 'Professional Fees',
                short_name: 'Prof-Fees',
                acc_type_code_debit: 'DR',
                acc_type_code_credit: 'CR'
            }
        ];
    }
    
    exportToCSV() {
        if (this.filteredAccounts.length === 0) {
            this.showToast('No data to export', 'warning');
            return;
        }
        
        const headers = [
            'PTS Account No', 'Account Name', 'Short Name', 'Account Type',
            'Debit Code', 'Credit Code', 'Created By', 'Created On', 'Updated On'
        ];
        
        const csvContent = [
            headers.join(','),
            ...this.filteredAccounts.map(account => [
                account.pts_account_no,
                `"${account.name || ''}"`,
                `"${account.short_name || ''}"`,
                `"${this.getAccountTypeText(account.pts_account_no)}"`,
                account.acc_type_code_debit || '',
                account.acc_type_code_credit || '',
                account.created_by || '',
                this.formatDateForExport(account.created_on),
                this.formatDateForExport(account.updated_on)
            ].join(','))
        ].join('\n');
        
        const filename = `chart_of_accounts_${new Date().toISOString().split('T')[0]}.csv`;
        this.downloadFile(csvContent, filename, 'text/csv');
        this.showToast(`Exported ${this.filteredAccounts.length} accounts successfully!`, 'success');
    }
    
    getAccountTypeText(accountNo) {
        const firstDigit = accountNo.charAt(0);
        const types = {
            '1': 'Asset', '2': 'Liability', '3': 'Equity',
            '4': 'Revenue', '5': 'Cost of Sales', '6': 'Expense', '9': 'Other'
        };
        return types[firstDigit] || 'Unknown';
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
    
    // Import Modal Functions
    showImportModal() {
        document.getElementById('importModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    closeImportModal() {
        document.getElementById('importModal').style.display = 'none';
        document.body.style.overflow = 'auto';
        this.clearFileSelection();
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.csv')) {
                this.showToast('Please select a CSV file', 'error');
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                this.showToast('File size must be less than 5MB', 'error');
                return;
            }
            
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileInfo').style.display = 'flex';
            document.getElementById('importDataBtn').disabled = false;
        }
    }
    
    clearFileSelection() {
        document.getElementById('csvFile').value = '';
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('importDataBtn').disabled = true;
    }
    
    async handleImport() {
        const fileInput = document.getElementById('csvFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Please select a file first', 'error');
            return;
        }
        
        try {
            const csvText = await this.readFileAsText(file);
            const importData = this.parseCSV(csvText);
            
            if (importData.length === 0) {
                this.showToast('No valid data found in the CSV file', 'error');
                return;
            }
            
            const confirmMsg = `Import ${importData.length} accounts? This will update existing accounts with the same number.`;
            if (confirm(confirmMsg)) {
                await this.processImport(importData);
            }
        } catch (error) {
            console.error('Import error:', error);
            this.showToast('Error processing file. Please check the format and try again.', 'error');
        }
    }
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }
    
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length >= 2 && values[0].trim()) {
                const row = {
                    pts_account_no: values[0].trim().substring(0, 20),
                    name: values[1] ? values[1].trim().substring(0, 500) : '',
                    short_name: values[2] ? values[2].trim().substring(0, 150) : '',
                    acc_type_code_debit: values[3] ? values[3].trim().substring(0, 50) : '',
                    acc_type_code_credit: values[4] ? values[4].trim().substring(0, 50) : ''
                };
                
                if (row.pts_account_no && row.name) {
                    data.push(row);
                }
            }
        }
        
        return data;
    }
    
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }
    
    async processImport(importData) {
        let successCount = 0;
        let errorCount = 0;
        
        for (const account of importData) {
            try {
                const response = await fetch(`/api/accounts/${account.pts_account_no}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: account.name,
                        short_name: account.short_name,
                        acc_type_code_debit: account.acc_type_code_debit,
                        acc_type_code_credit: account.acc_type_code_credit
                    })
                });
                
                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }
        
        this.closeImportModal();
        
        if (successCount > 0) {
            this.showToast(`Import completed! ${successCount} accounts updated successfully.${errorCount > 0 ? ` ${errorCount} errors occurred.` : ''}`, 'success');
            this.loadAccounts();
        } else {
            this.showToast('Import failed. Please check your data and try again.', 'error');
        }
    }
    
    // Utility Functions
    showLoading(show) {
        const loading = document.getElementById('loading');
        const table = document.getElementById('accountsTable');
        
        if (show) {
            loading.style.display = 'flex';
            table.style.display = 'none';
        } else {
            loading.style.display = 'none';
        }
    }
    
    showError() {
        document.getElementById('errorMessage').style.display = 'flex';
        document.getElementById('retryBtn').onclick = () => this.loadAccounts();
    }
    
    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }
    
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const messageEl = document.querySelector('.toast-message');
        
        messageEl.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            this.hideToast();
        }, 5000);
    }
    
    hideToast() {
        document.getElementById('toast').style.display = 'none';
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    formatDateForExport(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    }
}

// Initialize the system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.coaManager = new ChartOfAccountsManager();
});

// Global utility functions
function printTable() {
    window.print();
}

// Keyboard shortcuts help
document.addEventListener('keydown', (e) => {
    // Ctrl+P for print
    if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        printTable();
    }
    
    // Ctrl+E for export
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        window.coaManager.exportToCSV();
    }
    
    // Ctrl+I for import
    if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        window.coaManager.showImportModal();
    }
    
    // Ctrl+N for new account
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        window.coaManager.showAccountModal();
    }
});