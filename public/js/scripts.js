// ==============================
// Alertas com fade in
/*
document.addEventListener("DOMContentLoaded", function(){
    function showAlert(alertId) {
      const alertEl = document.getElementById(alertId);
      if (alertEl && alertEl.textContent.trim() !== "") {
        alertEl.style.display = "block";
        void alertEl.offsetWidth;
        alertEl.classList.add("show");
      }
    }
    showAlert("success-alert");
    showAlert("error-alert");
  });
  */

  // ==============================
  // Atualização de data final com base na data de início e duração
  // ==============================
  document.addEventListener("DOMContentLoaded", function() {
    function addDays(date, days) {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    }
    function formatDate(date) {
      return date.toISOString().split("T")[0];
    }
    function updateEndDate(periodIndex, durationDays) {
      const inicioInput = document.getElementById(`periodo${periodIndex}_inicio`);
      const fimInput = document.getElementById(`periodo${periodIndex}_fim`);
      if (inicioInput.value) {
        const startDate = new Date(inicioInput.value);
        const endDate = addDays(startDate, durationDays - 1);
        fimInput.value = formatDate(endDate);
      }
    }
    function updateAllEndDates() {
      const qtd = document.getElementById('qtd_periodos').value;
      if (qtd === "1") {
        updateEndDate(1, 30);
      } else if (qtd === "2_10_20") {
        updateEndDate(1, 10);
        updateEndDate(2, 20);
      } else if (qtd === "2_15_15") {
        updateEndDate(1, 15);
        updateEndDate(2, 15);
      } else if (qtd === "2_20_10") {
        updateEndDate(1, 20);
        updateEndDate(2, 10);
      } else if (qtd === "3") {
        updateEndDate(1, 10);
        updateEndDate(2, 10);
        updateEndDate(3, 10);
      }
    }
    ['periodo1_inicio', 'periodo2_inicio', 'periodo3_inicio'].forEach(function(id) {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("change", updateAllEndDates);
      }
    });
    const qtdInput = document.getElementById("qtd_periodos");
    if(qtdInput) {
      qtdInput.addEventListener("change", updateAllEndDates);
    }
  });
  
  // ==============================
  // Seleção de data de ingresso via lista suspensa
  // ==============================
  document.addEventListener("DOMContentLoaded", function () {
    const btnSelecionarData = document.getElementById("btnSelecionarData");
    const listaDatas = document.getElementById("listaDatas");
    const inputData = document.getElementById("data_ingresso");
  
    if(btnSelecionarData && listaDatas && inputData) {
      btnSelecionarData.addEventListener("click", function () {
        listaDatas.style.display = listaDatas.style.display === "none" ? "block" : "none";
      });
  
      document.querySelectorAll(".selecionar-data").forEach(item => {
        item.addEventListener("click", function () {
          const dataBr = this.textContent.trim();
          const [dia, mes, ano] = dataBr.split("/");
          const dataIso = `${ano}-${mes}-${dia}`;
          inputData.value = dataIso;
          listaDatas.style.display = "none";
        });
      });
  
      document.addEventListener("click", function (event) {
        if (!btnSelecionarData.contains(event.target) && !listaDatas.contains(event.target)) {
          listaDatas.style.display = "none";
        }
      });
    }
  });
  
  // ==============================
  // Filtro da tabela de servidores
  // ==============================
  document.addEventListener("DOMContentLoaded", function () {
    const filterAnoInput = document.getElementById("filter-ano");
    const anoAtual = new Date().getFullYear().toString();
    if (filterAnoInput && !filterAnoInput.value) {
      filterAnoInput.value = anoAtual;
    }
  
    function applyAllFilters() {
      const filterMes = document.getElementById("filter-mes").value;
      const filterNome = document.getElementById("filter-nome").value.trim().toLowerCase();
      const filterMatricula = document.getElementById("filter-matricula").value.trim().toLowerCase();
      const filterAno = document.getElementById("filter-ano").value;
  
      const tableIds = ['ipcTable', 'epcTable', 'dpcTable'];
      tableIds.forEach(function (tableId) {
        document.querySelectorAll(`#${tableId} tbody tr`).forEach(function (row) {
          const rowMes = row.getAttribute('data-mes-ferias') || '';
          const rowAno = row.getAttribute('data-ano') || '';
          const nome = row.querySelector('td:nth-child(4)')?.textContent.toLowerCase() || '';
          const matricula = row.querySelector('td:nth-child(3)')?.textContent.toLowerCase() || '';
  
          const matchMes = !filterMes || rowMes.split(',').includes(filterMes);
          const matchNome = !filterNome || nome.includes(filterNome);
          const matchMatricula = !filterMatricula || matricula.includes(filterMatricula);
          const matchAno = !filterAno || rowAno === filterAno;
  
          const feriasText = row.querySelector('td:nth-child(18)')?.textContent.trim().toLowerCase() || '';
          const hasFerias = feriasText !== 'nenhuma';
  
          row.style.display = (matchMes && matchNome && matchMatricula && matchAno && hasFerias) ? '' : 'none';
        });
      });
    }
  
    const filterElements = [
      document.getElementById("filter-mes"),
      document.getElementById("filter-nome"),
      document.getElementById("filter-matricula"),
      document.getElementById("filter-ano")
    ];
    filterElements.forEach(el => {
      if (el) {
        el.addEventListener('input', applyAllFilters);
        el.addEventListener('change', applyAllFilters);
      }
    });
  
    const btnFilterAno = document.getElementById("btn-filter-ano");
    if (btnFilterAno) btnFilterAno.addEventListener('click', applyAllFilters);
  
    // Aplica os filtros após preencher o ano atual
    applyAllFilters();
  });
  
  // ==============================
  // Scripts para PDF
  // ==============================
  function getTableData(tableId) {
    var table = document.getElementById(tableId);
    var data = [];
    var headers = [];
    table.querySelectorAll("thead tr th").forEach(function(th, index) {
      if (index !== 0 && index !== 18) {
        headers.push(th.innerText.trim());
      }
    });
    data.push(headers);
    table.querySelectorAll("tbody tr").forEach(function(tr) {
      if (window.getComputedStyle(tr).display !== "none") {
        var rowData = [];
        tr.querySelectorAll("td").forEach(function(td, index) {
          if (index !== 0 && index !== 16) {
            rowData.push(td.innerText.trim());
          }
        });
        data.push(rowData);
      }
    });
    return data;
  }
  
  function getAppliedFilters() {
    var filters = [];
    var filterMes = document.getElementById("filter-mes").value;
    var filterNome = document.getElementById("filter-nome").value;
    var filterMatricula = document.getElementById("filter-matricula").value;
    var filterAno = document.getElementById("filter-ano").value;
    if (filterMes) filters.push("Mês: " + filterMes);
    if (filterNome) filters.push("Nome: " + filterNome);
    if (filterMatricula) filters.push("Matrícula: " + filterMatricula);
    if (filterAno) filters.push("Ano: " + filterAno);
    return filters.length ? filters.join(" | ") : "Sem filtros aplicados";
  }
  
  function downloadPDF(tableId, title, filename) {
    var tableData = getTableData(tableId);
    var filters = getAppliedFilters();
    var docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 30, 10, 20],
      header: {
        text: title + " - " + filters,
        margin: [20, 20, 10, 0],
        fontSize: 8
      },
      content: [
        {
          table: {
            headerRows: 1,
            widths: [25, 30, 50, 50, 30, 30, 30, 30, 30, 60, 35, 30, 55, 30, 55, 55, '*'],
            body: tableData
          },
          layout: {
            paddingLeft: function(i, node) { return 2; },
            paddingRight: function(i, node) { return 2; },
            paddingTop: function(i, node) { return 1; },
            paddingBottom: function(i, node) { return 1; }
          }
        }
      ],
      defaultStyle: { fontSize: 10 }
    };
    pdfMake.createPdf(docDefinition).download(filename);
  }
  
  function getSimplifiedTableData(tableId) {
    var table = document.getElementById(tableId);
    var data = [];
    var headers = [];
    table.querySelectorAll("thead tr th").forEach(function(th, index) {
      if (index === 0 || index === 2 || index === 3 || index === table.querySelectorAll("thead tr th").length - 1) {
        headers.push(th.innerText.trim());
      }
    });
    data.push(headers);
    table.querySelectorAll("tbody tr").forEach(function(tr) {
      if (window.getComputedStyle(tr).display !== "none") {
        var rowData = [];
        var tds = tr.querySelectorAll("td");
        tds.forEach(function(td, index) {
          if (index === 0 || index === 2 || index === 3 || index === tds.length - 1) {
            rowData.push(td.innerText.trim());
          }
        });
        data.push(rowData);
      }
    });
    return data;
  }
  
  function downloadSimplifiedPDF(tableId, title, filename) {
    var tableData = getSimplifiedTableData(tableId);
    var filters = getAppliedFilters();
    var docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [40, 40, 20, 20],
      header: {
        text: title + " - " + filters,
        margin: [10, 10, 10, 0],
        fontSize: 8
      },
      content: [
        {
          table: {
            headerRows: 1,
            widths: [25, 70, 70, 100],
            body: tableData
          },
          layout: {
            paddingLeft: function(i, node) { return 2; },
            paddingRight: function(i, node) { return 2; },
            paddingTop: function(i, node) { return 1; },
            paddingBottom: function(i, node) { return 1; }
          }
        }
      ],
      defaultStyle: { fontSize: 10 }
    };
    pdfMake.createPdf(docDefinition).download(filename);
  }
  
  document.getElementById("download-ipc").addEventListener("click", function(){
    downloadPDF("ipcTable", "Classificação dos IPCs", "classificacao_IPC.pdf");
  });
  document.getElementById("download-epc").addEventListener("click", function(){
    downloadPDF("epcTable", "Classificação dos EPCs", "classificacao_EPC.pdf");
  });
  document.getElementById("download-dpc").addEventListener("click", function(){
    downloadPDF("dpcTable", "Classificação dos DPCs", "classificacao_DPC.pdf");
  });
  document.getElementById("download-simplificado-ipc").addEventListener("click", function(){
    downloadSimplifiedPDF("ipcTable", "Classificação Simplificada dos IPCs", "classificacao_simplificada_IPC.pdf");
  });
  document.getElementById("download-simplificado-epc").addEventListener("click", function(){
    downloadSimplifiedPDF("epcTable", "Classificação Simplificada dos EPCs", "classificacao_simplificada_EPC.pdf");
  });
  document.getElementById("download-simplificado-dpc").addEventListener("click", function(){
    downloadSimplifiedPDF("dpcTable", "Classificação Simplificada dos DPCs", "classificacao_simplificada_DPC.pdf");
  });
  
  // ==============================
  // Fecha o offcanvas automaticamente antes de abrir um modal
  // ==============================
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-bs-toggle="modal"]').forEach(link => {
      link.addEventListener('click', function () {
        const offcanvasEl = document.querySelector('.offcanvas.show');
        if (offcanvasEl) {
          const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
          offcanvas.hide();
        }
      });
    });
  });
  
  // ==============================
  // Botão Alterar Usuário - Carregar formulário via fetch
  // ==============================
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-target="#editUsuarioModal"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const matricula = btn.getAttribute('data-matricula');
        const ano = btn.getAttribute('data-ano'); // ← pega do botão
        if (!ano) return;
  
        try {
          const res = await fetch(`/users/edit/${matricula}/${ano}`);
          const html = await res.text();
          document.getElementById('usuarioModalBody').innerHTML = html;
          const modal = new bootstrap.Modal(document.getElementById('editUsuarioModal'));
          modal.show();
        } catch (err) {
          console.error('Erro ao carregar formulário de usuário:', err);
        }
      });
    });
  });
  document.addEventListener('DOMContentLoaded', () => {
    // Clique no botão "Alterar Férias"
    document.querySelectorAll('[data-target="#editFeriasModal"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const matricula = btn.getAttribute('data-matricula');
        const ano = btn.getAttribute('data-ano');
  
        try {
          const res = await fetch(`/vacations/edit/${matricula}/${ano}`);
          const html = await res.text();
          document.getElementById('feriasModalBody').innerHTML = html;
  
          // Reanexar evento após carregar novo HTML
          attachEditVacationFormHandler();
  
          const modal = new bootstrap.Modal(document.getElementById('editFeriasModal'));
          modal.show();
        } catch (err) {
          showToast('Erro ao carregar formulário.', 'error');
        }
      });
    });
  });
  
  function attachEditVacationFormHandler() {
    console.log('[JS] handler de edição de férias carregado!');
  
    const editForm = document.querySelector('#editFeriasModal form');
    if (!editForm) return;
  
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      const formData = new URLSearchParams(new FormData(editForm)); // ✅ alteração aqui
      const matricula = editForm.dataset.matricula;
      const ano = editForm.dataset.ano;
  
      try {
        const res = await fetch(`/vacations/edit/${matricula}/${ano}`, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });
  
        const result = await res.json();
  
        if (result.success) {
          showToast(result.message, 'success');
          const modal = bootstrap.Modal.getInstance(document.getElementById('editFeriasModal'));
          modal.hide();
          setTimeout(() => location.reload(), 2500);
        } else {
          showToast(result.message, 'error');
        }
      } catch (err) {
        console.error('Erro no envio:', err);
        showToast('Erro ao atualizar as férias.', 'error');
      }
    });
  }
  
  
  
  function showToast(message, type = 'success') {
    const container = document.createElement('div');
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = 9999;
  
    const toast = document.createElement('div');
    toast.className = `toast show toast-progress toast-${type}`;
    toast.role = 'alert';
    toast.ariaLive = 'assertive';
    toast.ariaAtomic = 'true';
  
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Fechar"></button>
      </div>
      <div class="toast-progress-bar"></div>
    `;
  
    container.appendChild(toast);
    document.body.appendChild(container);
  
    // 🟢 Fecha automaticamente após 4 segundos
    setTimeout(() => {
      toast.classList.remove('show');
      container.remove();
    }, 4000);
  
    // 🔴 Permite fechar manualmente
    const closeBtn = toast.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        container.remove();
      });
    }
  }
  
  