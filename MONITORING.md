# 📊 Monitoramento — AG Fotografia v1.0.0

**Sistema de monitoramento em tempo real para operação em produção**

---

## 🎯 Checklist Diário

### ✅ Manhã (Inicialização)

```bash
# 1. Verificar status do servidor
curl http://127.0.0.1:3000/api/health

# 2. Revisar audit log de ontem
tail -50 dados/backups/audit.log

# 3. Verificar espaço em disco
Get-Volume D:

# 4. Listar arquivos recentes em TEMP
Get-ChildItem images/temp/ -File | Sort-Object LastWriteTime -Desc | Select -First 5
```

### ⏪ Meio do Dia (Monitoramento)

```bash
# 5. Contar lotes processados
(Get-ChildItem Finalizadas/ -Directory).Count

# 6. Verificar tamanho do audit log
(Get-Item dados/backups/audit.log).Length / 1MB

# 7. Testar endpoints principais
@("/api/captura/temp", "/api/lotes", "/api/qa/produtos", "/api/carros", "/api/adset/status") | 
  ForEach-Object { 
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:3000$_" -TimeoutSec 5
    Write-Host "$_: OK" -ForegroundColor Green
  }
```

### 🌙 Noite (Conclusão)

```bash
# 8. Backup dos dados
Copy-Item -Path "dados\" -Destination "backups/backup-$(Get-Date -Format yyyyMMdd)" -Recurse

# 9. Verificar erros no dia
Select-String "ERROR\|FAIL" dados/backups/audit.log | Measure-Object | Select -ExpandProperty Count

# 10. Revisar performance
Get-Process | Where-Object { $_.ProcessName -eq "node" } | Select Handles, VirtualMemorySize
```

---

## 📈 Métricas de Produção

| Métrica | Target | Alerta |
|---------|--------|--------|
| **API Response Time** | <500ms | >1s |
| **Disk Usage** | <80% | >90% |
| **Memory Usage** | <500MB | >1GB |
| **Error Rate** | <0.1% | >1% |
| **Uptime** | 99.9% | <95% |

---

## 🔍 Logs Importantes

### audit.log (Operações)
```
[2026-08-13T10:00:00.123Z] SERVER_START {host, port}
[2026-08-13T10:01:00.456Z] CAPTURA_SAVE {lote, gtin, fotos: 5}
[2026-08-13T10:02:00.789Z] EXCEL_IMPORT {items: 10, conflicts: 0}
[2026-08-13T10:03:00.012Z] QA_CLASSIFY {lote, gtin, classification: AP}
[2026-08-13T10:04:00.345Z] DELIVERY_EXECUTE {status: COMPLETED}
[2026-08-13T10:05:00.678Z] VEHICLE_IMPORT {lote, vehiclesImported: 3}
[2026-08-13T10:06:00.901Z] ADSET_DELIVER {status: SUCCESS}
```

**Onde:** `dados/backups/audit.log`  
**Rotação:** Diária  
**Retenção:** 90 dias

---

## 🚨 Alertas de Erro

| Mensagem | Causa | Solução |
|----------|-------|---------|
| `Path Traversal Blocked` | Tentativa de acesso ../../../ | Verificar logs, possível ataque |
| `Formula Injection Blocked` | Excel com fórmulas | Remover =, +, -, @ do arquivo |
| `JSON Corrompido` | Crash durante escrita | Restaurar de backup automático |
| `Port 3000 em Uso` | Outro processo usando porta | `netstat -ano \| findstr :3000` |
| `Disk Space Low` | <2GB livre | Arquivar dados antigos |

---

## 📊 Comandos de Monitoramento

### PowerShell (Windows)

```powershell
# Status completo do sistema
function Get-SystemStatus {
    Write-Host "=== AG Fotografia Status ===" -ForegroundColor Cyan
    
    # 1. Servidor
    $server = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -TimeoutSec 5
    if ($server.ok) {
        Write-Host "✅ Servidor: ONLINE" -ForegroundColor Green
        Write-Host "   Versão: $($server.version)"
    } else {
        Write-Host "❌ Servidor: OFFLINE" -ForegroundColor Red
    }
    
    # 2. Disk
    $disk = Get-Volume | Where-Object { $_.DriveLetter -eq "D" }
    $freeGB = [math]::Round($disk.SizeRemaining / 1GB, 2)
    $totalGB = [math]::Round($disk.Size / 1GB, 2)
    $percentUsed = [math]::Round(($disk.Size - $disk.SizeRemaining) / $disk.Size * 100, 1)
    
    $diskColor = if ($percentUsed -gt 90) { "Red" } elseif ($percentUsed -gt 80) { "Yellow" } else { "Green" }
    Write-Host "💾 Disco D:\ " -ForegroundColor Cyan -NoNewline
    Write-Host "$percentUsed% usado ($freeGB GB livre de $totalGB GB)" -ForegroundColor $diskColor
    
    # 3. Lotes
    $loteCount = (Get-ChildItem Finalizadas/ -Directory -ErrorAction SilentlyContinue).Count
    Write-Host "📦 Lotes processados: $loteCount" -ForegroundColor Green
    
    # 4. Memory
    $process = Get-Process | Where-Object { $_.ProcessName -eq "node" }
    if ($process) {
        $memMB = [math]::Round($process.WorkingSet / 1MB, 1)
        Write-Host "💾 Node.js Memory: $memMB MB" -ForegroundColor Green
    }
    
    # 5. Uptime
    $logFile = Get-Item "dados/backups/audit.log" -ErrorAction SilentlyContinue
    if ($logFile) {
        $uptime = [math]::Round(((Get-Date) - $logFile.LastWriteTime).TotalHours, 1)
        Write-Host "⏱️  Uptime: ~$uptime horas" -ForegroundColor Green
    }
}

Get-SystemStatus
```

### Bash (Linux/WSL)

```bash
#!/bin/bash

echo "=== AG Fotografia Status ==="

# 1. Servidor
if curl -s http://127.0.0.1:3000/api/health > /dev/null; then
    echo "✅ Servidor: ONLINE"
else
    echo "❌ Servidor: OFFLINE"
fi

# 2. Disk
DISK=$(df -h /d | tail -1)
echo "💾 Disco: $DISK"

# 3. Lotes
LOTES=$(ls -d Finalizadas/* 2>/dev/null | wc -l)
echo "📦 Lotes: $LOTES"

# 4. Memory
MEM=$(ps aux | grep "node server" | grep -v grep | awk '{print $6}')
echo "💾 Memory: ${MEM}KB"

# 5. Errors
ERRORS=$(grep -c "ERROR\|FAIL" dados/backups/audit.log 2>/dev/null || echo 0)
echo "⚠️  Erros no log: $ERRORS"
```

---

## 🔧 Performance Tuning

### Memory Optimization
```javascript
// server.js - Monitorar memory leaks
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log(`Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  
  // Alert if exceeds 800MB
  if (memUsage.heapUsed > 800 * 1024 * 1024) {
    console.warn('⚠️ High memory usage detected');
  }
}, 60000); // Check every minute
```

### Connection Pooling
```javascript
// Para DB future (v1.1)
const pool = require('pg').Pool;
const dbPool = new pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Caching Strategy
```javascript
// Cache for frequently accessed data
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 min TTL

app.get('/api/lotes', (req, res) => {
  const cached = cache.get('lotes');
  if (cached) return res.json(cached);
  
  // Fetch data...
  cache.set('lotes', data);
  res.json(data);
});
```

---

## 📞 Troubleshooting Rápido

### Servidor Não Inicia
```bash
# 1. Verificar porta em uso
netstat -ano | findstr :3000

# 2. Matar processo
taskkill /PID <id> /F

# 3. Tentar novamente
npm start
```

### Alto Uso de Disco
```bash
# 1. Encontrar arquivos grandes
Get-ChildItem -Path "Finalizadas" -Recurse | Sort-Object Length -Desc | Select -First 10

# 2. Arquivar dados antigos
Move-Item -Path "Finalizadas/Lote_001" -Destination "archive/Lote_001"

# 3. Limpar TEMP
Remove-Item images/temp/* -Force
```

### Logs Muito Grandes
```bash
# 1. Verificar tamanho
(Get-Item dados/backups/audit.log).Length / 1MB

# 2. Arquivar log antigo
Rename-Item datos/backups/audit.log "dados/backups/audit.log.$(Get-Date -Format yyyyMMdd)"

# 3. Log novo começa automaticamente
```

---

## 📋 Checklist Semanal

- [ ] Revisar audit.log (erros)
- [ ] Fazer backup completo
- [ ] Testar ADSET (se real)
- [ ] Validar performance
- [ ] Revisar espaço disco
- [ ] Atualizar documentação
- [ ] Treinar novo operador (se necessário)
- [ ] Planejar manutenção

---

## 📞 Suporte 24/7

| Problema | Contato | Prioridade |
|----------|---------|-----------|
| Servidor down | PagerDuty | 🔴 Crítica |
| Performance degradada | Slack #ops | 🟡 Alta |
| Memória alta | Monitoring alerts | 🟡 Alta |
| Disco cheio | Slack #alerts | 🔴 Crítica |

---

**Mantém o sistema saudável! 💪**

*AG Fotografia v1.0.0 — Monitoramento em Produção*
