// ==UserScript==
// @name         Strava活动导出图片
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  将Strava活动页面导出为可分享的图片
// @author       You
// @match        https://www.strava.com/activities/*
// @grant        none
// @require      https://html2canvas.hertzen.com/dist/html2canvas.min.js
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .strava-export-button {
            background-color: #fc5200;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            margin: 10px;
        }
        
        .strava-export-dialog {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }
        
        .strava-export-content {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            width: 600px;
            max-width: 90%;
        }
        
        .strava-export-preview {
            position: relative;
            width: 100%;
            height: 500px;
            background-color: #1a1a1a;
            margin-bottom: 20px;
            border-radius: 8px;
            overflow: hidden;
            color: #ffcc00;
        }
        
        .color-picker-container {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .color-picker-item {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .export-actions {
            display: flex;
            justify-content: space-between;
        }
    `;
    document.head.appendChild(style);

    // 等待页面加载完成
    window.addEventListener('load', function() {
        // 添加导出按钮
        const actionMenu = document.querySelector('.actions-menu');
        if (actionMenu) {
            const exportButton = document.createElement('button');
            exportButton.className = 'strava-export-button';
            exportButton.textContent = '导出图片';
            exportButton.addEventListener('click', showExportDialog);
            actionMenu.appendChild(exportButton);
        }
    });

    // 显示导出对话框
    function showExportDialog() {
        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'strava-export-dialog';
        
        // 对话框内容
        const content = document.createElement('div');
        content.className = 'strava-export-content';
        
        // 预览区域
        const preview = document.createElement('div');
        preview.className = 'strava-export-preview';
        
        // 颜色选择区域
        const colorPickerContainer = document.createElement('div');
        colorPickerContainer.className = 'color-picker-container';
        
        // 背景颜色选择
        const bgColorPicker = createColorPicker('背景颜色', '#1a1a1a', function(color) {
            preview.style.backgroundColor = color;
            updatePreview();
        });
        
        // 文字颜色选择
        const textColorPicker = createColorPicker('文字颜色', '#ffcc00', function(color) {
            preview.style.color = color;
            updatePreview();
        });
        
        // 路线颜色选择
        const routeColorPicker = createColorPicker('路线颜色', '#ffcc00', function(color) {
            currentRouteColor = color;
            updatePreview();
        });
        
        colorPickerContainer.appendChild(bgColorPicker);
        colorPickerContainer.appendChild(textColorPicker);
        colorPickerContainer.appendChild(routeColorPicker);
        
        // 按钮区域
        const actions = document.createElement('div');
        actions.className = 'export-actions';
        
        // 取消按钮
        const cancelButton = document.createElement('button');
        cancelButton.className = 'strava-export-button';
        cancelButton.style.backgroundColor = '#666';
        cancelButton.textContent = '取消';
        cancelButton.addEventListener('click', function() {
            document.body.removeChild(dialog);
        });
        
        // 导出按钮
        const exportButton = document.createElement('button');
        exportButton.className = 'strava-export-button';
        exportButton.textContent = '导出';
        exportButton.addEventListener('click', function() {
            exportImage(preview);
        });
        
        actions.appendChild(cancelButton);
        actions.appendChild(exportButton);
        
        // 组装对话框
        content.appendChild(preview);
        content.appendChild(colorPickerContainer);
        content.appendChild(actions);
        dialog.appendChild(content);
        
        document.body.appendChild(dialog);
        
        // 获取活动数据并生成预览
        const activityData = extractActivityData();
        generatePreview(preview, activityData);
    }

    // 当前路线颜色
    let currentRouteColor = '#ffcc00';

    // 创建颜色选择器
    function createColorPicker(label, defaultColor, onChange) {
        const container = document.createElement('div');
        container.className = 'color-picker-item';
        
        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        
        const input = document.createElement('input');
        input.type = 'color';
        input.value = defaultColor;
        input.addEventListener('input', function() {
            onChange(this.value);
        });
        
        container.appendChild(labelElement);
        container.appendChild(input);
        
        return container;
    }

    // 从页面提取活动数据
    function extractActivityData() {
        const data = {};
        
        // 获取活动标题
        const titleElement = document.querySelector('.activity-name');
        data.title = titleElement ? titleElement.textContent.trim() : 'Strava活动';
        
        // 获取活动日期
        const dateElement = document.querySelector('.details-container time');
        data.date = dateElement ? dateElement.textContent.trim() : '';
        
        // 从inline-stats section获取基本数据
        const inlineStats = document.querySelector('.inline-stats.section');
        if (inlineStats) {
            // 距离
            const distanceElement = inlineStats.querySelector('li:nth-child(1) strong');
            if (distanceElement) {
                data.distance = distanceElement.textContent.trim();
                const unitElement = distanceElement.querySelector('abbr.unit');
                if (unitElement) {
                    data.distanceUnit = unitElement.textContent.trim();
                }
            }
            
            // 移动时间
            const movingTimeElement = inlineStats.querySelector('li:nth-child(2) strong');
            if (movingTimeElement) {
                data.movingTime = movingTimeElement.textContent.trim();
            }
            
            // 海拔爬升
            const elevationElement = inlineStats.querySelector('li:nth-child(3) strong');
            if (elevationElement) {
                data.elevation = elevationElement.textContent.trim();
                const unitElement = elevationElement.querySelector('abbr.unit');
                if (unitElement) {
                    data.elevationUnit = unitElement.textContent.trim();
                }
            }
        }
        
        // 从secondary-stats获取平均功率
        const secondaryStats = document.querySelector('.inline-stats.section.secondary-stats');
        if (secondaryStats) {
            const powerElement = secondaryStats.querySelector('li:first-child strong');
            if (powerElement) {
                data.power = powerElement.textContent.trim();
                const unitElement = powerElement.querySelector('abbr.unit');
                if (unitElement) {
                    data.powerUnit = unitElement.textContent.trim();
                }
            }
        }
        
        // 从more-stats获取平均速度
        const moreStats = document.querySelector('.section.more-stats');
        if (moreStats) {
            const speedRow = moreStats.querySelector('tbody tr:first-child');
            if (speedRow) {
                const avgSpeedElement = speedRow.querySelector('td:first-child');
                if (avgSpeedElement) {
                    data.avgSpeed = avgSpeedElement.textContent.trim();
                    const unitElement = avgSpeedElement.querySelector('abbr.unit');
                    if (unitElement) {
                        data.avgSpeedUnit = unitElement.textContent.trim();
                    }
                }
            }
        }
        
        // 从心率数据获取平均心率
        const heartRateRow = document.querySelector('.section.more-stats .show-more-block-js tr:first-child');
        if (heartRateRow) {
            const avgHrElement = heartRateRow.querySelector('td:first-child');
            if (avgHrElement) {
                data.avgHeartRate = avgHrElement.textContent.trim();
                const unitElement = avgHrElement.querySelector('abbr.unit');
                if (unitElement) {
                    data.avgHeartRateUnit = unitElement.textContent.trim();
                }
            }
        }
        
        // 获取路线数据
        const routePathElement = document.querySelector('.leaflet-interactive');
        if (routePathElement) {
            data.routePath = routePathElement.getAttribute('d');
        }
        
        return data;
    }

    // 生成预览
    function generatePreview(preview, data) {
        // 清空预览区域
        preview.innerHTML = '';
        
        // 添加活动标题
        const title = document.createElement('h1');
        title.style.fontSize = '32px';
        title.style.fontWeight = 'bold';
        title.style.margin = '20px';
        title.style.fontFamily = 'Arial, sans-serif';
        title.textContent = data.title || 'Strava活动';
        preview.appendChild(title);
        
        // 添加活动日期
        const date = document.createElement('div');
        date.style.fontSize = '16px';
        date.style.margin = '0 20px 20px 20px';
        date.style.fontFamily = 'Arial, sans-serif';
        date.textContent = data.date || '';
        preview.appendChild(date);
        
        // 创建数据显示区域
        const dataContainer = document.createElement('div');
        dataContainer.style.display = 'flex';
        dataContainer.style.justifyContent = 'space-around';
        dataContainer.style.margin = '20px';
        dataContainer.style.fontFamily = 'Arial, sans-serif';
        
        // 添加距离
        dataContainer.appendChild(createDataItem('距离', data.distance || '0', data.distanceUnit || 'km'));
        
        // 添加移动时间
        dataContainer.appendChild(createDataItem('总时长', data.movingTime || '0:00:00', ''));
        
        // 添加爬升
        dataContainer.appendChild(createDataItem('累计爬升', data.elevation || '0', data.elevationUnit || 'm'));
        
        preview.appendChild(dataContainer);
        
        // 创建第二行数据显示
        const dataContainer2 = document.createElement('div');
        dataContainer2.style.display = 'flex';
        dataContainer2.style.justifyContent = 'space-around';
        dataContainer2.style.margin = '20px';
        dataContainer2.style.fontFamily = 'Arial, sans-serif';
        
        // 添加平均速度
        dataContainer2.appendChild(createDataItem('平均速度', data.avgSpeed || '0', data.avgSpeedUnit || 'km/h'));
        
        // 添加平均功率
        dataContainer2.appendChild(createDataItem('平均功率', data.power || '0', data.powerUnit || 'W'));
        
        // 添加平均心率
        dataContainer2.appendChild(createDataItem('平均心率', data.avgHeartRate || '0', data.avgHeartRateUnit || 'bpm'));
        
        preview.appendChild(dataContainer2);
        
        // 添加路线图
        if (data.routePath) {
            const routeContainer = document.createElement('div');
            routeContainer.style.margin = '20px';
            routeContainer.style.height = '200px';
            routeContainer.style.position = 'relative';
            
            const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgElement.setAttribute('width', '100%');
            svgElement.setAttribute('height', '100%');
            svgElement.style.overflow = 'visible';
            
            const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathElement.setAttribute('d', data.routePath);
            pathElement.setAttribute('stroke', currentRouteColor);
            pathElement.setAttribute('stroke-width', '3');
            pathElement.setAttribute('fill', 'none');
            svgElement.appendChild(pathElement);
            
            // 添加SVG可视区域适配
            setTimeout(() => {
                const bbox = pathElement.getBBox();
                const padding = 20;
                const viewBox = [
                    bbox.x - padding,
                    bbox.y - padding,
                    bbox.width + padding * 2,
                    bbox.height + padding * 2
                ].join(' ');
                svgElement.setAttribute('viewBox', viewBox);
            }, 0);
            
            routeContainer.appendChild(svgElement);
            preview.appendChild(routeContainer);
        }
        
        // 添加水印
        const watermark = document.createElement('div');
        watermark.style.position = 'absolute';
        watermark.style.bottom = '10px';
        watermark.style.right = '10px';
        watermark.style.fontSize = '12px';
        watermark.style.opacity = '0.7';
        watermark.textContent = 'Generated by Strava Export';
        preview.appendChild(watermark);
    }

    // 创建数据项
    function createDataItem(label, value, unit) {
        const container = document.createElement('div');
        container.style.textAlign = 'center';
        
        const valueElement = document.createElement('div');
        valueElement.style.fontSize = '36px';
        valueElement.style.fontWeight = 'bold';
        valueElement.textContent = value;
        
        if (unit) {
            const unitSpan = document.createElement('span');
            unitSpan.style.fontSize = '16px';
            unitSpan.style.marginLeft = '2px';
            unitSpan.textContent = unit;
            valueElement.appendChild(unitSpan);
        }
        
        const labelElement = document.createElement('div');
        labelElement.style.fontSize = '14px';
        labelElement.style.marginTop = '5px';
        labelElement.textContent = label;
        
        container.appendChild(valueElement);
        container.appendChild(labelElement);
        
        return container;
    }

    // 更新预览
    function updatePreview() {
        const preview = document.querySelector('.strava-export-preview');
        const activityData = extractActivityData();
        
        // 更新路线颜色
        const pathElement = preview.querySelector('svg path');
        if (pathElement) {
            pathElement.setAttribute('stroke', currentRouteColor);
        }
    }

    // 导出图片
    function exportImage(element) {
        html2canvas(element, {
            backgroundColor: element.style.backgroundColor,
            allowTaint: true,
            useCORS: true,
            scale: 2
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'strava-activity.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }
})(); 