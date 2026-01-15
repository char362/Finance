import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


class BillTracker {
    constructor(userId) {
        this.userId = userId;
        this.bills = [];
        this.initialBalance = 0;
        this.cleanedDays = [];
        this.savings = [];
        this.currentDate = new Date();

        this.initElements();
        this.initEvents();
        this.initNavigation();

        this.currentEditId = null;

        // Date Display
        const dateEl = document.getElementById('current-date');
        const now = new Date();
        if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Dark Mode Init
        this.initTheme();

        this.loadData();
    }

    initTheme() {
        const toggle = document.getElementById('dark-mode-toggle');
        const savedTheme = localStorage.getItem('theme');

        // Apply saved or default
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            if (toggle) toggle.checked = true;
        }

        // Listener
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.body.classList.add('dark-mode');
                    localStorage.setItem('theme', 'dark');
                } else {
                    document.body.classList.remove('dark-mode');
                    localStorage.setItem('theme', 'light');
                }
            });
        }
    }

    async loadData() {
        try {
            const docRef = doc(db, "users", this.userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                this.bills = data.myBills || [];
                this.initialBalance = data.myBalance || 0;
                this.cleanedDays = data.myCleanedDays || [];
                this.savings = data.mySavings || [];
            } else {
                console.log("No existing data, starting fresh.");
            }
        } catch (error) {
            console.error("Error loading data:", error);
            // Fallback or Alert?
        }

        this.render();
        this.renderCalendar();
        this.renderSavings();
        if (this.balanceInput) this.balanceInput.value = this.initialBalance;
    }

    initElements() {
        this.billList = document.getElementById('bill-list');
        // Updated IDs to match new HTML
        this.totalAmountEl = document.getElementById('total-amount');
        this.totalPaidEl = document.getElementById('total-paid');
        this.totalRemainingEl = document.getElementById('total-remaining');
        this.chartContainer = document.getElementById('chart-container');

        this.modal = document.getElementById('modal');
        this.addBtn = document.getElementById('add-btn');
        this.cancelBtn = document.getElementById('cancel-btn');
        this.billForm = document.getElementById('bill-form');

        // Inputs
        this.inputName = document.getElementById('bill-name');
        this.inputAmount = document.getElementById('bill-amount');
        this.inputDue = document.getElementById('bill-due');
        this.inputType = document.getElementById('bill-type');

        // Balance Elements
        this.balanceInput = document.getElementById('initial-balance');
        this.saveBalanceBtn = document.getElementById('save-balance-btn');
        this.resetBalanceBtn = document.getElementById('reset-balance-btn');
        this.cardBalanceEl = document.getElementById('card-balance');

        // Savings Elements
        this.savingsList = document.getElementById('savings-list');
        this.inputSavingsName = document.getElementById('savings-name');
        this.inputSavingsAmount = document.getElementById('savings-amount');
        this.addSavingsBtn = document.getElementById('add-savings-btn');
        this.totalSavingsEl = document.getElementById('total-savings');

        // Settings Elements
        this.resetAllBtn = document.getElementById('reset-all-btn');

        // Calendar Elements
        this.calendarGrid = document.getElementById('calendar-grid');
        this.monthYearEl = document.getElementById('calendar-month-year');
        this.prevMonthBtn = document.getElementById('prev-month');
        this.nextMonthBtn = document.getElementById('next-month');

        if (this.balanceInput) this.balanceInput.value = this.initialBalance;
    }

    initEvents() {
        // Modal Controls
        if (this.addBtn) {
            this.addBtn.addEventListener('click', () => {
                this.currentEditId = null; // Reset edit state
                this.billForm.reset();
                if (this.inputType) this.inputType.value = 'expense';

                // Reset button text
                const submitBtn = this.billForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Save Bill';

                this.modal.classList.remove('hidden');
                this.inputName.focus();
            });
        }

        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => {
                this.modal.classList.add('hidden');
            });
        }

        // Add New Bill
        if (this.billForm) {
            this.billForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addBill();
            });
        }

        // Click outside modal to close
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.modal.classList.add('hidden');
            });
        }

        // Save Balance
        if (this.saveBalanceBtn) {
            this.saveBalanceBtn.addEventListener('click', () => {
                const val = parseFloat(this.balanceInput.value);
                if (!isNaN(val)) {
                    this.initialBalance = val;
                    this.save();
                    this.render();
                    alert('Balance Updated!');
                }
            });
        }

        // Reset Balance
        if (this.resetBalanceBtn) {
            this.resetBalanceBtn.addEventListener('click', () => {
                if (confirm('Reset current balance to 0?')) {
                    this.initialBalance = 0;
                    this.balanceInput.value = '';
                    this.save();
                    this.render();
                }
            });
        }

        // Reset All Data
        if (this.resetAllBtn) {
            this.resetAllBtn.addEventListener('click', async () => {
                if (confirm('WARNING: Are you sure you want to delete ALL data? This cannot be undone.')) {
                    await deleteDoc(doc(db, "users", this.userId));
                    location.reload();
                }
            });
        }

        // Add Savings
        if (this.addSavingsBtn) {
            this.addSavingsBtn.addEventListener('click', () => {
                this.addSavings();
            });
        }

        // Calendar Controls
        if (this.prevMonthBtn) {
            this.prevMonthBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.renderCalendar();
            });
        }
        if (this.nextMonthBtn) {
            this.nextMonthBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.renderCalendar();
            });
        }

        // Backup Controls
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');
        const importFile = document.getElementById('import-file');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', (e) => this.importData(e));
        }
    }

    exportData() {
        const data = {
            myBills: this.bills,
            myBalance: this.initialBalance,
            myCleanedDays: this.cleanedDays,
            mySavings: this.savings,
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `finance-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.myBills || data.myBalance || data.mySavings) {
                    // Handle both stringified (old backup) and object (new backup) formats
                    const parseIfNeeded = (val) => typeof val === 'string' ? JSON.parse(val) : val;

                    this.bills = parseIfNeeded(data.myBills) || [];
                    this.initialBalance = parseFloat(data.myBalance) || 0;
                    this.cleanedDays = parseIfNeeded(data.myCleanedDays) || [];
                    this.savings = parseIfNeeded(data.mySavings) || [];

                    await this.save();
                    alert('Data restored successfully! The page will now reload.');
                    location.reload();
                } else {
                    alert('Invalid backup file. Missing data.');
                }
            } catch (err) {
                console.error(err);
                alert('Error reading backup file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    initNavigation() {
        const navLinks = {
            dashboard: document.getElementById('nav-dashboard'),
            wallet: document.getElementById('nav-wallet'),
            settings: document.getElementById('nav-settings'),
            calendar: document.getElementById('nav-calendar')
        };

        // Mobile Links
        const mobileLinks = {
            dashboard: document.getElementById('mobile-nav-dashboard'),
            wallet: document.getElementById('mobile-nav-wallet'),
            settings: document.getElementById('mobile-nav-settings'),
            calendar: document.getElementById('mobile-nav-calendar')
        };

        const views = {
            dashboard: document.getElementById('view-dashboard'),
            wallet: document.getElementById('view-wallet'),
            settings: document.getElementById('view-settings'),
            calendar: document.getElementById('view-calendar')
        };

        const switchView = (target) => {
            // Update Desktop Nav
            Object.values(navLinks).forEach(el => { if (el) el.classList.remove('active'); });
            if (navLinks[target]) navLinks[target].classList.add('active');

            // Update Mobile Nav
            Object.values(mobileLinks).forEach(el => { if (el) el.classList.remove('active'); });
            if (mobileLinks[target]) mobileLinks[target].classList.add('active');

            // Update View
            Object.values(views).forEach(el => { if (el) el.classList.add('hidden'); });
            if (views[target]) views[target].classList.remove('hidden');

            // Persist View
            localStorage.setItem('activeView', target);
        };

        // Desktop Events
        if (navLinks.dashboard) navLinks.dashboard.addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
        if (navLinks.wallet) navLinks.wallet.addEventListener('click', (e) => { e.preventDefault(); switchView('wallet'); });
        if (navLinks.settings) navLinks.settings.addEventListener('click', (e) => { e.preventDefault(); switchView('settings'); });
        if (navLinks.calendar) navLinks.calendar.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('calendar');
            this.renderCalendar();
        });

        // Mobile Events (Same logic)
        if (mobileLinks.dashboard) mobileLinks.dashboard.addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
        if (mobileLinks.wallet) mobileLinks.wallet.addEventListener('click', (e) => { e.preventDefault(); switchView('wallet'); });
        if (mobileLinks.settings) mobileLinks.settings.addEventListener('click', (e) => { e.preventDefault(); switchView('settings'); });
        if (mobileLinks.calendar) mobileLinks.calendar.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('calendar');
            this.renderCalendar();
        });

        // Restore View
        const savedView = localStorage.getItem('activeView') || 'dashboard';
        switchView(savedView);
        if (savedView === 'calendar') this.renderCalendar();
    }

    addBill() {
        const name = this.inputName.value;
        const amount = parseFloat(this.inputAmount.value);
        const dueDate = this.inputDue.value;
        const type = this.inputType ? this.inputType.value : 'expense';

        if (name && amount && dueDate) {
            if (this.currentEditId) {
                // Update Existing Bill
                const index = this.bills.findIndex(b => b.id === this.currentEditId);
                if (index !== -1) {
                    this.bills[index] = {
                        ...this.bills[index],
                        name,
                        amount,
                        dueDate,
                        type: type || 'expense'
                    };
                }
                this.currentEditId = null;
            } else {
                // Add New Bill
                const bill = {
                    id: Date.now(),
                    name,
                    amount,
                    dueDate,
                    type: type || 'expense',
                    paid: false
                };
                this.bills.push(bill);
            }

            this.save();
            this.render();
            this.modal.classList.add('hidden');
        }

    }

    togglePaid(id) {
        const bill = this.bills.find(b => b.id === id);
        if (bill) {
            bill.paid = !bill.paid;
            this.save();
            this.render();
        }
    }

    deleteBill(id) {
        if (confirm('Delete this bill?')) {
            this.bills = this.bills.filter(b => b.id !== id);
            this.save();
            this.render();
        }
    }

    async save() {
        try {
            const data = {
                myBills: this.bills,
                myBalance: this.initialBalance,
                myCleanedDays: this.cleanedDays,
                mySavings: this.savings
            };
            await setDoc(doc(db, "users", this.userId), data);
        } catch (e) {
            console.error("Error saving data: ", e);
            alert("Error saving data check console.");
        }
    }

    render() {
        // Sort by Due Date
        this.bills.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        // Calculate Totals
        const totalIncome = this.bills.filter(b => b.type === 'income').reduce((sum, b) => sum + b.amount, 0);
        const totalExpenses = this.bills.filter(b => b.type !== 'income').reduce((sum, b) => sum + b.amount, 0);

        // Expense Breakdown
        const totalPaidVal = this.bills.filter(b => b.type !== 'income' && b.paid).reduce((sum, b) => sum + b.amount, 0);
        const totalRemainingVal = this.bills.filter(b => b.type !== 'income' && !b.paid).reduce((sum, b) => sum + b.amount, 0);

        // Update Dashboard Cards
        if (this.totalAmountEl) {
            // Changed "Total Bills" (top-left) to "Total Expenses"
            this.totalAmountEl.textContent = `$${totalExpenses.toFixed(2)}`;
            const label = this.totalAmountEl.parentElement.querySelector('.label');
            if (label) label.textContent = 'Total Expenses';
        }

        if (this.totalPaidEl) {
            // Changed "Paid" (middle) to "Income"
            this.totalPaidEl.textContent = `$${totalIncome.toFixed(2)}`;
            const label = this.totalPaidEl.parentElement.querySelector('.label');
            if (label) label.textContent = 'Total Income';

            // Icon update for context
            const icon = this.totalPaidEl.parentElement.parentElement.querySelector('.card-icon');
            if (icon) icon.textContent = '💵';
        }

        if (this.totalRemainingEl) {
            // "Pending" -> "Disposable Balance" (Income - Expenses)
            const balance = totalIncome - totalExpenses;
            this.totalRemainingEl.textContent = `$${balance.toFixed(2)}`;
            this.totalRemainingEl.style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';

            const label = this.totalRemainingEl.parentElement.querySelector('.label');
            if (label) label.textContent = 'Net Balance';
        }

        // Update Card Balance (Initial + Net Balance -> Projected View)
        if (this.cardBalanceEl) {
            // Calculate Projected Balance (Initial + All Income - All Expenses)
            const currentBalance = this.initialBalance + totalIncome - totalExpenses;
            this.cardBalanceEl.textContent = `$${currentBalance.toFixed(2)}`;
        }

        // Render List
        if (this.billList) {
            this.billList.innerHTML = '';

            if (this.bills.length === 0) {
                this.billList.innerHTML = '<div style="padding:20px; color:var(--text-secondary); text-align:center;">No transactions yet.</div>';
            } else {
                this.bills.forEach(bill => {
                    // Handle both old (day number) and new (YYYY-MM-DD) data
                    let dateDisplay;
                    if (bill.dueDate && bill.dueDate.includes && bill.dueDate.includes('-')) {
                        // ISO String
                        const [y, m, d] = bill.dueDate.split('-');
                        const dateObj = new Date(y, m - 1, d);
                        dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    } else {
                        // Legacy Day Number
                        dateDisplay = bill.dueDay ? `Day ${bill.dueDay}` : 'No Date';
                    }

                    const div = document.createElement('div');
                    div.className = 'transaction-item';
                    div.onclick = () => this.togglePaid(bill.id); // Click row to toggle

                    div.innerHTML = `
                        <div class="check-wrapper">
                            <div class="t-name">
                                ${bill.name.includes('Transfer to') ? '<span style="color:#3b82f6; margin-right:5px;">⇄</span>' : ''}
                                ${bill.name}
                            </div>
                        </div>
                        <div class="t-date">${dateDisplay}</div>
                        <div class="t-amount" style="color: ${bill.type === 'income' ? 'var(--success)' : ''}">
                            ${bill.type === 'income' ? '+' : ''}$${bill.amount.toFixed(2)}
                        </div>
                        <div class="t-status">
                             ${bill.type === 'income'
                            ? '<span class="status-badge paid">Received</span>'
                            : `<span class="status-badge ${bill.paid ? 'paid' : 'pending'}">${bill.paid ? 'Paid' : 'Pending'}</span>`
                        }
                        </div>
                        <div class="icon-group">
                            <div class="edit-icon">✎</div>
                            <div class="delete-icon">×</div>
                        </div>
                    `;

                    // Attach event listeners
                    const editBtn = div.querySelector('.edit-icon');
                    const deleteBtn = div.querySelector('.delete-icon');

                    if (editBtn) {
                        editBtn.addEventListener('click', (e) => {
                            e.stopPropagation(); // Stop row click
                            this.startEdit(bill.id);
                        });
                    }

                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation(); // Stop row click
                            this.deleteBill(bill.id);
                        });
                    }

                    this.billList.appendChild(div);
                });
            }
        }

        this.renderChart();
    }

    startEdit(id) {
        const bill = this.bills.find(b => b.id === id);
        if (bill) {
            this.currentEditId = id;

            this.inputName.value = bill.name;
            this.inputAmount.value = bill.amount;
            this.inputDue.value = bill.dueDate;
            if (this.inputType) this.inputType.value = bill.type || 'expense';

            // Switch to update mode UI
            const submitBtn = this.billForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Update Bill';

            this.modal.classList.remove('hidden');
        }
    }

    renderChart() {
        if (!this.chartContainer) return;
        this.chartContainer.innerHTML = '';

        // --- Helper: Group Data ---
        const groupData = (items) => {
            const grouped = {};
            items.forEach(bill => {
                const name = bill.name.trim();
                if (!grouped[name]) grouped[name] = 0;
                grouped[name] += bill.amount;
            });
            return Object.keys(grouped)
                .map(name => ({ name, amount: grouped[name] }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 4); // Show top 4 of each to fit space
        };

        const incomeData = groupData(this.bills.filter(b => b.type === 'income'));
        const expenseData = groupData(this.bills.filter(b => b.type !== 'income'));

        // Find max for scale (normalize both to same scale or independent? independent is better for visibility)
        const maxIncome = Math.max(...incomeData.map(d => d.amount), 1);
        const maxExpense = Math.max(...expenseData.map(d => d.amount), 1);

        // --- Render Helper ---
        const createSection = (title, data, maxVal, colorVar, isEmpty) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'chart-section-half';
            wrapper.innerHTML = `<div class="chart-label-small">${title}</div><div class="bars-row"></div>`;
            const row = wrapper.querySelector('.bars-row');

            if (isEmpty) {
                row.innerHTML = '<span style="font-size:10px; color:var(--text-secondary);">No Data</span>';
                return wrapper;
            }

            data.forEach(d => {
                const height = (d.amount / maxVal) * 80 + 10;
                const barDiv = document.createElement('div');
                barDiv.className = 'bar-wrapper';
                barDiv.innerHTML = `
                    <div class="bar" style="height:${height}%; background:${colorVar}"></div>
                    <span class="bar-label">${d.name.substring(0, 3)}</span>
                `;
                row.appendChild(barDiv);
            });
            return wrapper;
        };

        const incomeSection = createSection('Income', incomeData, maxIncome, 'var(--success)', incomeData.length === 0);
        const expenseSection = createSection('Expenses', expenseData, maxExpense, 'var(--bg-card-hover)', expenseData.length === 0);

        this.chartContainer.appendChild(incomeSection);
        this.chartContainer.appendChild(expenseSection);
    }

    renderCalendar() {
        if (!this.calendarGrid) return;
        this.calendarGrid.innerHTML = '';

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Update Header
        if (this.monthYearEl) {
            this.monthYearEl.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }

        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Pad Start
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            this.calendarGrid.appendChild(empty);
        }

        // Render Days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isCleaned = this.cleanedDays.includes(dateStr);

            const dayDiv = document.createElement('div');
            dayDiv.textContent = d;
            dayDiv.style.cssText = `
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                cursor: pointer;
                background: ${isCleaned ? 'var(--success)' : 'transparent'};
                color: ${isCleaned ? 'white' : 'var(--text-primary)'};
                border: 1px solid ${isCleaned ? 'var(--success)' : 'var(--bg-card-hover)'};
                transition: all 0.2s;
            `;

            dayDiv.addEventListener('click', () => {
                if (this.cleanedDays.includes(dateStr)) {
                    this.cleanedDays = this.cleanedDays.filter(day => day !== dateStr);
                } else {
                    this.cleanedDays.push(dateStr);
                }
                this.save();
                this.renderCalendar(); // Re-render to update UI
            });

            this.calendarGrid.appendChild(dayDiv);
        }
    }

    getOrdinal(n) {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    // --- Savings Features ---

    renderSavings() {
        if (!this.savingsList) return;
        this.savingsList.innerHTML = '';

        let total = 0;

        if (this.savings.length === 0) {
            this.savingsList.innerHTML = '<div style="color:var(--text-secondary); font-size:14px; text-align:center;">No savings accounts yet.</div>';
        } else {
            this.savings.forEach((acct, index) => {
                total += acct.amount;
                const div = document.createElement('div');
                div.className = 'savings-item';
                div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-card-hover); margin-bottom:8px; border-radius:8px;';
                div.innerHTML = `
                    <div style="font-weight:600;">${acct.name}</div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="color:var(--success); margin-right:8px;">$${acct.amount.toFixed(2)}</span>
                        <button class="deposit-savings" title="Deposit Cash" style="background:var(--success); border:none; color:white; border-radius:4px; width:30px; height:30px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; font-size:16px;">+</button>
                        <button class="transfer-savings" title="Transfer from Checking" style="background:#3b82f6; border:none; color:white; border-radius:4px; width:30px; height:30px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; font-size:14px;">⇄</button>
                        <button class="withdraw-savings" title="Transfer back to Checking" style="background:#f59e0b; border:none; color:white; border-radius:4px; width:30px; height:30px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; font-size:16px;">↩</button>
                        <button class="delete-savings" title="Delete Account" style="background:var(--danger); border:none; color:white; border-radius:4px; width:30px; height:30px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; font-size:16px;">×</button>
                    </div>
                `;

                div.querySelector('.deposit-savings').addEventListener('click', () => this.depositToSavings(index));
                div.querySelector('.transfer-savings').addEventListener('click', () => this.transferFromChecking(index));
                div.querySelector('.withdraw-savings').addEventListener('click', () => this.withdrawFromSavings(index));
                div.querySelector('.delete-savings').addEventListener('click', () => this.deleteSavings(index));
                this.savingsList.appendChild(div);
            });
        }

        if (this.totalSavingsEl) {
            this.totalSavingsEl.textContent = `$${total.toFixed(2)}`;
        }
    }

    addSavings() {
        const name = this.inputSavingsName.value;
        const amount = parseFloat(this.inputSavingsAmount.value);

        if (name && !isNaN(amount)) {
            this.savings.push({ name, amount });
            this.save();
            this.renderSavings();

            // Clear inputs
            this.inputSavingsName.value = '';
            this.inputSavingsAmount.value = '';
        } else {
            alert('Please enter a valid name and amount.');
        }
    }

    // Manual Deposit (Cash/External)
    depositToSavings(index) {
        let amountStr = prompt('Enter amount to deposit (Cash/External):');
        if (amountStr) {
            // Remove '$', ',', and whitespace
            amountStr = amountStr.replace(/[$,\s]/g, '');
            const amount = parseFloat(amountStr);
            if (!isNaN(amount) && amount > 0) {
                this.savings[index].amount += amount;
                this.save();
                this.renderSavings();
            } else {
                alert('Invalid amount. Please enter a number (e.g. 50.00).');
            }
        }
    }

    // Transfer from Checking (Auto-Transaction)
    transferFromChecking(index) {
        let amountStr = prompt(`Transfer from Checking to ${this.savings[index].name}:`);
        if (amountStr) {
            amountStr = amountStr.replace(/[$,\s]/g, '');
            const amount = parseFloat(amountStr);
            if (!isNaN(amount) && amount > 0) {
                // 1. Add to Savings
                this.savings[index].amount += amount;

                // 2. Deduct from Checking (Create Expense)
                const transaction = {
                    id: Date.now(),
                    name: `Transfer to ${this.savings[index].name}`,
                    amount: amount,
                    dueDate: new Date().toISOString().split('T')[0], // Today
                    type: 'expense',
                    paid: true // Deducts immediately
                };
                this.bills.push(transaction);

                this.save();
                this.render(); // Updates Balance & Transaction List
                this.renderSavings(); // Updates Savings Total

                alert(`Transferred $${amount} to ${this.savings[index].name}`);
            } else {
                alert('Invalid amount. Please enter a number.');
            }
        }
    }

    // Withdraw to Checking (Auto-Transaction)
    withdrawFromSavings(index) {
        let amountStr = prompt(`Transfer from ${this.savings[index].name} back to Checking:`);
        if (amountStr) {
            amountStr = amountStr.replace(/[$,\s]/g, '');
            const amount = parseFloat(amountStr);
            if (!isNaN(amount) && amount > 0) {
                if (this.savings[index].amount >= amount) {
                    // 1. Deduct from Savings
                    this.savings[index].amount -= amount;

                    // 2. Add to Checking (Create Income Transaction)
                    const transaction = {
                        id: Date.now(),
                        name: `Transfer from ${this.savings[index].name}`,
                        amount: amount,
                        dueDate: new Date().toISOString().split('T')[0],
                        type: 'income', // Income adds to balance
                        paid: true // Received immediately
                    };
                    this.bills.push(transaction);

                    this.save();
                    this.render();
                    this.renderSavings();
                    alert(`Transferred $${amount.toFixed(2)} back to Checking.`);
                } else {
                    alert('Insufficient savings balance.');
                }
            } else {
                alert('Invalid amount. Please enter a number.');
            }
        }
    }

    deleteSavings(index) {
        if (confirm('Remove this savings account?')) {
            this.savings.splice(index, 1);
            this.save();
            this.renderSavings();
        }
    }

    initAuth() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                signOut(auth).then(() => {
                    // Sign-out successful.
                    location.reload(); // Simple reload to clear state/reset view
                }).catch((error) => {
                    alert('Error logging out: ' + error.message);
                });
            });
        }
    }
}

// Auth Logic
const authView = document.getElementById('auth-view');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authButton = document.querySelector('#auth-form button');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const authError = document.getElementById('auth-error');

// Password Recovery Elements
const forgotPasswordLink = document.getElementById('forgot-password-link');
const resetPasswordView = document.getElementById('reset-password-view');
const resetPasswordForm = document.getElementById('reset-password-form');
const resetEmailInput = document.getElementById('reset-email');
const backToLoginBtn = document.getElementById('back-to-login-btn');
const loginCard = document.querySelector('.auth-card:not(#reset-password-view)'); // Select the main login card

let isLoginMode = true; // Renamed from isLoginMode

// Forgot Password Flow
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (loginCard) loginCard.style.display = 'none';
        if (resetPasswordView) {
            resetPasswordView.style.display = 'block';
            resetPasswordView.classList.remove('hidden');
        }
    });
}

if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', () => {
        if (resetPasswordView) {
            resetPasswordView.style.display = 'none';
            resetPasswordView.classList.add('hidden');
        }
        if (loginCard) loginCard.style.display = 'block';
    });
}

if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = resetEmailInput.value;
        if (email) {
            try {
                await sendPasswordResetEmail(auth, email);
                alert(`Password reset link sent to ${email}`);
                backToLoginBtn.click(); // Return to login
            } catch (error) {
                console.error(error);
                alert('Error: ' + error.message);
            }
        }
    });
}

// Toggle Login/Signup
if (authSwitchBtn) {
    authSwitchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        if (isLoginMode) {
            authTitle.textContent = 'Welcome Back';
            authForm.querySelector('button').textContent = 'Sign In';
            authSwitchText.textContent = "Don't have an account? ";
            authSwitchBtn.textContent = 'Sign Up';
        } else {
            authTitle.textContent = 'Create Account';
            authSubtitle.textContent = 'Join to track your finance';
            authForm.querySelector('button').textContent = 'Sign Up';
            authSwitchText.textContent = "Already have an account? ";
            authSwitchBtn.textContent = 'Sign In';
        }
        authError.style.display = 'none';
        authForm.reset();
    });
}

// Handle Form Submit
if (authForm) {
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = authEmail.value;
        const password = authPassword.value;
        authError.style.display = 'none';

        if (isLoginMode) {
            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    // Signed in 
                    console.log('Logged in:', userCredential.user.email);
                })
                .catch((error) => {
                    authError.textContent = 'Login Error: ' + error.message.replace('Firebase: ', '');
                    authError.style.display = 'block';
                });
        } else {
            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    // Signed up 
                    console.log('Signed up:', userCredential.user.email);
                })
                .catch((error) => {
                    authError.textContent = 'Signup Error: ' + error.message.replace('Firebase: ', '');
                    authError.style.display = 'block';
                });
        }
    });
}

// Auth State Monitor
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        document.body.classList.remove('auth-mode');
        if (authView) authView.style.display = 'none';

        // Initialize App if not already
        if (!window.app) {
            window.app = new BillTracker(user.uid);
            window.app.initAuth(); // Initialize logout listener
        }
    } else {
        // User is signed out
        document.body.classList.add('auth-mode');
        if (authView) authView.style.display = 'flex';
        window.app = null; // Clear app instance
    }
});
