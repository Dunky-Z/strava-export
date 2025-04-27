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
            overflow: auto;
            padding: 20px;
        }

        .strava-export-content {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
        }

        .strava-export-preview-container {
            width: 100%;
            padding-top: 133.33%; /* 3:4 比例 */
            position: relative;
            margin-bottom: 20px;
        }

        .strava-export-preview {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #000000;
            border-radius: 8px;
            overflow: hidden;
            color: #ffcc00;
            padding: 30px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }

        .strava-export-preview-scroll {
            overflow-y: auto;
            max-height: 70vh;
        }

        .color-option-container {
            display: flex;
            flex-direction: column;
            margin-bottom: 20px;
            width: 100%;
            box-sizing: border-box;
        }

        .color-group {
            display: flex;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }

        .color-label {
            font-weight: bold;
            margin-bottom: 5px;
            width: 100%;
        }

        .color-option {
            width: 30px;
            height: 30px;
            border-radius: 4px;
            margin-right: 10px;
            cursor: pointer;
            border: 2px solid transparent;
        }

        .color-option.selected {
            border-color: #333;
        }

        .export-actions {
            display: flex;
            justify-content: space-between;
            position: sticky;
            bottom: 0;
            background-color: white;
            padding-top: 10px;
        }

        .esc-tip {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 10px;
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

    // 颜色预设
    const bgColorPresets = [
        { value: '#000000', label: '黑色' },
        { value: '#1D1D1D', label: '深灰' },
        { value: '#212121', label: '深灰2' },
        { value: '#333333', label: '灰色' }
    ];

    const textColorPresets = [
        { value: '#ffcc00', label: '金黄色' },
        { value: '#FF5500', label: 'Strava橙' },
        { value: '#FFFFFF', label: '白色' },
        { value: '#33cc33', label: '绿色' }
    ];

    const routeColorPresets = [
        { value: '#ffcc00', label: '金黄色' },
        { value: '#FF5500', label: 'Strava橙' },
        { value: '#FFFFFF', label: '白色' },
        { value: '#33cc33', label: '绿色' }
    ];

    // 当前颜色
    let currentBgColor = '#000000';
    let currentTextColor = '#ffcc00';
    let currentRouteColor = '#ffcc00';

    // 当前打开的对话框引用
    let currentDialog = null;

    // 显示导出对话框
    function showExportDialog() {
        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'strava-export-dialog';

        // 保存对话框引用，以便在按ESC键时关闭
        currentDialog = dialog;

        // 对话框内容
        const content = document.createElement('div');
        content.className = 'strava-export-content';

        // 预览容器（保持3:4比例）
        const previewContainer = document.createElement('div');
        previewContainer.className = 'strava-export-preview-container';

        // 预览区域
        const preview = document.createElement('div');
        preview.className = 'strava-export-preview';
        preview.style.backgroundColor = currentBgColor;
        preview.style.color = currentTextColor;

        previewContainer.appendChild(preview);

        // 颜色选择区域
        const colorContainer = document.createElement('div');
        colorContainer.className = 'color-option-container';

        // 背景颜色选择
        colorContainer.appendChild(createColorGroup('背景颜色', bgColorPresets, currentBgColor, function(color) {
            currentBgColor = color;
            preview.style.backgroundColor = color;
        }));

        // 文字颜色选择
        colorContainer.appendChild(createColorGroup('文字颜色', textColorPresets, currentTextColor, function(color) {
            currentTextColor = color;
            preview.style.color = color;
            updatePreview();
        }));

        // 路线颜色选择
        colorContainer.appendChild(createColorGroup('路线颜色', routeColorPresets, currentRouteColor, function(color) {
            currentRouteColor = color;
            updatePreview();
        }));

        // 按钮区域
        const actions = document.createElement('div');
        actions.className = 'export-actions';

        // 取消按钮
        const cancelButton = document.createElement('button');
        cancelButton.className = 'strava-export-button';
        cancelButton.style.backgroundColor = '#666';
        cancelButton.textContent = '取消';
        cancelButton.addEventListener('click', function() {
            closeDialog();
        });

        // 导出按钮
        const exportButton = document.createElement('button');
        exportButton.className = 'strava-export-button';
        exportButton.textContent = '导出';
        exportButton.addEventListener('click', function() {
            const originalPreview = document.createElement('div');
            originalPreview.className = 'strava-export-preview';
            originalPreview.style.backgroundColor = currentBgColor;
            originalPreview.style.color = currentTextColor;
            originalPreview.style.position = 'fixed';
            originalPreview.style.left = '-9999px';
            originalPreview.style.top = '-9999px';
            originalPreview.style.width = '600px'; // 固定宽度
            originalPreview.style.height = '800px'; // 3:4 比例
            document.body.appendChild(originalPreview);
            
            // 复制预览内容到导出用的元素
            const activityData = extractActivityData();
            generatePreview(originalPreview, activityData);
            
            // 延迟500毫秒确保SVG渲染完成
            setTimeout(() => {
                // 确保SVG路径已经计算了viewBox
                const pathElement = originalPreview.querySelector('svg path');
                if (pathElement) {
                    const svgElement = pathElement.parentElement;
                    if (!svgElement.getAttribute('viewBox')) {
                        // 如果viewBox尚未设置，手动计算并设置
                        try {
                            const bbox = pathElement.getBBox();
                            const padding = 20;
                            const viewBox = [
                                bbox.x - padding,
                                bbox.y - padding,
                                bbox.width + padding * 2,
                                bbox.height + padding * 2
                            ].join(' ');
                            svgElement.setAttribute('viewBox', viewBox);
                        } catch (e) {
                            console.error('计算SVG viewBox失败:', e);
                        }
                    }
                }
                
                exportImage(originalPreview, function() {
                    document.body.removeChild(originalPreview);
                });
            }, 500);
        });

        actions.appendChild(cancelButton);
        actions.appendChild(exportButton);

        // ESC键提示
        const escTip = document.createElement('div');
        escTip.className = 'esc-tip';
        escTip.textContent = '按ESC键可关闭此窗口';

        // 组装对话框
        content.appendChild(previewContainer);
        content.appendChild(colorContainer);
        content.appendChild(actions);
        content.appendChild(escTip);
        dialog.appendChild(content);

        document.body.appendChild(dialog);

        // 获取活动数据并生成预览
        const activityData = extractActivityData();
        generatePreview(preview, activityData);

        // 确保对话框在可视区域内
        ensureDialogVisibility(dialog);

        // 添加ESC键关闭对话框的事件监听
        document.addEventListener('keydown', handleEscKey);
    }

    // 关闭对话框
    function closeDialog() {
        if (currentDialog) {
            document.body.removeChild(currentDialog);
            document.removeEventListener('keydown', handleEscKey);
            currentDialog = null;
        }
    }

    // 处理ESC键按下事件
    function handleEscKey(event) {
        if (event.key === 'Escape' && currentDialog) {
            closeDialog();
        }
    }

    // 确保对话框在可视区域内
    function ensureDialogVisibility(dialog) {
        setTimeout(() => {
            const content = dialog.querySelector('.strava-export-content');
            if (content.offsetHeight > window.innerHeight * 0.9) {
                content.style.height = '90vh';
            }
        }, 100);
    }

    // 创建颜色选择组
    function createColorGroup(label, presets, currentValue, onChange) {
        const container = document.createElement('div');

        const labelElement = document.createElement('div');
        labelElement.className = 'color-label';
        labelElement.textContent = label;
        container.appendChild(labelElement);

        const colorGroup = document.createElement('div');
        colorGroup.className = 'color-group';

        presets.forEach(preset => {
            const colorOption = document.createElement('div');
            colorOption.className = 'color-option';
            colorOption.style.backgroundColor = preset.value;
            colorOption.title = preset.label;
            if (preset.value === currentValue) {
                colorOption.classList.add('selected');
            }

            colorOption.addEventListener('click', function() {
                // 移除之前的选中
                colorGroup.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                // 添加新的选中
                colorOption.classList.add('selected');
                onChange(preset.value);
            });

            colorGroup.appendChild(colorOption);
        });

        // 添加自定义颜色选项
        const customColorInput = document.createElement('input');
        customColorInput.type = 'color';
        customColorInput.value = currentValue;
        customColorInput.style.marginLeft = '10px';
        customColorInput.addEventListener('input', function() {
            onChange(this.value);
            // 移除之前的选中
            colorGroup.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
            });
        });

        colorGroup.appendChild(customColorInput);
        container.appendChild(colorGroup);

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
                // 只保留数字部分
                let distance = distanceElement.textContent.trim();
                if (distance) {
                    // 提取数字部分
                    const match = distance.match(/^([\d.]+)/);
                    if (match) {
                        data.distance = match[1];
                    } else {
                        data.distance = distance;
                    }
                }

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
                // 只保留数字部分
                let elevation = elevationElement.textContent.trim();
                if (elevation) {
                    // 提取数字部分
                    const match = elevation.match(/^([\d.]+)/);
                    if (match) {
                        data.elevation = match[1];
                    } else {
                        data.elevation = elevation;
                    }
                }

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
                // 只保留数字部分
                let power = powerElement.textContent.trim();
                if (power) {
                    // 提取数字部分
                    const match = power.match(/^([\d.]+)/);
                    if (match) {
                        data.power = match[1];
                    } else {
                        data.power = power;
                    }
                }

                const unitElement = powerElement.querySelector('abbr.unit');
                if (unitElement) {
                    data.powerUnit = unitElement.textContent.trim();
                }
            }
        }

        // 从more-stats获取平均速度（修复获取问题）
        try {
            // 尝试多种方法获取平均速度
            let avgSpeed = '';

            // 方法1：查找更多统计中的表格
            const moreStats = document.querySelector('.section.more-stats');
            if (moreStats) {
                const speedRow = moreStats.querySelector('tbody tr:first-child');
                if (speedRow) {
                    const avgSpeedElement = speedRow.querySelector('td:first-child');
                    if (avgSpeedElement) {
                        avgSpeed = avgSpeedElement.textContent.trim();
                    }
                }
            }

            // 方法2：查找页面中显示的平均速度
            if (!avgSpeed) {
                const speedLabels = Array.from(document.querySelectorAll('th'));
                const speedLabel = speedLabels.find(el => el.textContent.includes('速度'));
                if (speedLabel && speedLabel.nextElementSibling) {
                    avgSpeed = speedLabel.nextElementSibling.textContent.trim();
                }
            }

            // 方法3：查找页面中任何带有速度单位的元素
            if (!avgSpeed) {
                const speedElements = document.querySelectorAll('[title="千米/小时"]');
                if (speedElements.length > 0) {
                    const el = speedElements[0].parentElement;
                    if (el) avgSpeed = el.textContent.trim();
                }
            }

            if (avgSpeed) {
                // 提取数字部分
                const match = avgSpeed.match(/^([\d.]+)/);
                if (match) {
                    data.avgSpeed = match[1];
                } else {
                    data.avgSpeed = '0';
                }

                data.avgSpeedUnit = 'km/h';
            } else {
                console.log('无法获取平均速度');
                data.avgSpeed = '0';
                data.avgSpeedUnit = 'km/h';
            }
        } catch (error) {
            console.error('获取平均速度时出错:', error);
            data.avgSpeed = '0';
            data.avgSpeedUnit = 'km/h';
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

        // 创建顶部区域（自行车图标+标题）
        const headerSection = document.createElement('div');
        headerSection.style.display = 'flex';
        headerSection.style.alignItems = 'center';
        headerSection.style.marginBottom = '10px';

        // 添加自行车图标
        const bikeIcon = document.createElement('div');
        bikeIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5,20.5A3.5,3.5 0 0,1 1.5,17A3.5,3.5 0 0,1 5,13.5A3.5,3.5 0 0,1 8.5,17A3.5,3.5 0 0,1 5,20.5M5,12A5,5 0 0,0 0,17A5,5 0 0,0 5,22A5,5 0 0,0 10,17A5,5 0 0,0 5,12M14.8,10H19V8.2H15.8L13.8,4.8C13.3,4.3 12.6,4 12,4C11.4,4 10.8,4.3 10.4,4.8L8.9,6.7L10.3,8.1L11.1,7.2C11.3,7 11.6,6.9 12,6.9C12.4,6.9 12.7,7 12.9,7.2L14.8,10M19,20.5A3.5,3.5 0 0,1 15.5,17A3.5,3.5 0 0,1 19,13.5A3.5,3.5 0 0,1 22.5,17A3.5,3.5 0 0,1 19,20.5M19,12A5,5 0 0,0 14,17A5,5 0 0,0 19,22A5,5 0 0,0 24,17A5,5 0 0,0 19,12M16,4.8C15,4.8 14.2,4 14.2,3C14.2,2 15,1.2 16,1.2C17,1.2 17.8,2 17.8,3C17.8,4 17,4.8 16,4.8Z" />
        </svg>`;
        bikeIcon.style.marginRight = '15px';
        headerSection.appendChild(bikeIcon);

        // 添加活动标题
        const titleContainer = document.createElement('div');

        const title = document.createElement('h1');
        title.style.fontSize = '36px';
        title.style.fontWeight = 'bold';
        title.style.margin = '0';
        title.style.fontFamily = 'Arial, sans-serif';
        title.textContent = data.title || 'Strava活动';

        // 添加活动日期
        const date = document.createElement('div');
        date.style.fontSize = '16px';
        date.style.fontFamily = 'Arial, sans-serif';
        date.textContent = data.date || '';

        titleContainer.appendChild(title);
        titleContainer.appendChild(date);
        headerSection.appendChild(titleContainer);

        preview.appendChild(headerSection);

        // 添加GARMIN样式的垂直文本在右侧（可选）
        // const brandText = document.createElement('div');
        // brandText.style.position = 'absolute';
        // brandText.style.right = '20px';
        // brandText.style.top = '50%';
        // brandText.style.transform = 'translateY(-50%)';
        // brandText.style.writingMode = 'vertical-rl';
        // brandText.style.textOrientation = 'upright';
        // brandText.style.fontWeight = 'bold';
        // brandText.style.fontSize = '24px';
        // brandText.style.letterSpacing = '2px';
        // brandText.textContent = 'STRAVA';
        // preview.appendChild(brandText);

        // 中间部分：距离数据和路线图并排显示
        const middleSection = document.createElement('div');
        middleSection.style.display = 'flex';
        middleSection.style.flexDirection = 'row';
        middleSection.style.justifyContent = 'space-between';
        middleSection.style.alignItems = 'center';
        middleSection.style.margin = '20px 0 30px 0';

        // 添加距离数据（左侧）
        const distanceContainer = document.createElement('div');
        distanceContainer.style.display = 'flex';
        distanceContainer.style.flexDirection = 'column';
        distanceContainer.style.alignItems = 'flex-start';
        distanceContainer.style.flex = '1';

        const distanceValue = document.createElement('div');
        distanceValue.style.fontSize = '60px';
        distanceValue.style.fontWeight = 'bold';
        distanceValue.style.display = 'flex';
        distanceValue.style.alignItems = 'center';

        const distanceNumber = document.createElement('span');
        distanceNumber.textContent = data.distance || '0';
        distanceValue.appendChild(distanceNumber);

        const distanceUnit = document.createElement('span');
        distanceUnit.style.fontSize = '30px';
        distanceUnit.style.marginLeft = '5px';
        distanceUnit.textContent = data.distanceUnit || 'km';
        distanceValue.appendChild(distanceUnit);

        const distanceLabel = document.createElement('div');
        distanceLabel.style.fontSize = '16px';
        distanceLabel.style.marginTop = '25px';
        distanceLabel.textContent = '距离';

        distanceContainer.appendChild(distanceValue);
        distanceContainer.appendChild(distanceLabel);
        middleSection.appendChild(distanceContainer);

        // 添加路线图（右侧）
        if (data.routePath) {
            const routeContainer = document.createElement('div');
            routeContainer.style.flex = '1';
            routeContainer.style.height = '180px';
            routeContainer.style.display = 'flex';
            routeContainer.style.justifyContent = 'flex-end';
            routeContainer.style.alignItems = 'center';

            const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgElement.setAttribute('width', '90%');
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
            middleSection.appendChild(routeContainer);
        }

        preview.appendChild(middleSection);

        // 添加底部网格数据区域
        const dataGrid = document.createElement('div');
        dataGrid.style.display = 'grid';
        dataGrid.style.gridTemplateColumns = '1fr 1fr';
        dataGrid.style.gridTemplateRows = 'auto auto';
        dataGrid.style.gap = '30px 15px'; // 行间距更大
        dataGrid.style.marginTop = '20px';
        dataGrid.style.fontFamily = 'Arial, sans-serif';
        dataGrid.style.flex = '1';

        // 添加4个数据项
        const timeItem = createDataItem('总时长', data.movingTime || '0:00:00', '', '60px');
        timeItem.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
        timeItem.style.paddingTop = '15px';
        dataGrid.appendChild(timeItem);

        const speedItem = createDataItem('平均速度', data.avgSpeed || '0', data.avgSpeedUnit || 'km/h', '60px');
        speedItem.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
        speedItem.style.paddingTop = '15px';
        dataGrid.appendChild(speedItem);

        const elevationItem = createDataItem('累计爬升', data.elevation || '0', data.elevationUnit || 'm', '60px');
        elevationItem.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
        elevationItem.style.paddingTop = '15px';
        dataGrid.appendChild(elevationItem);

        const powerItem = createDataItem('平均功率', data.power || '0', data.powerUnit || 'W', '60px');
        powerItem.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
        powerItem.style.paddingTop = '15px';
        dataGrid.appendChild(powerItem);

        preview.appendChild(dataGrid);

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
    function createDataItem(label, value, unit, fontSize = '42px') {
        const container = document.createElement('div');
        container.style.textAlign = 'left';

        const valueElement = document.createElement('div');
        valueElement.style.fontSize = fontSize;
        valueElement.style.fontWeight = 'bold';
        valueElement.style.display = 'flex';
        valueElement.style.alignItems = 'center';
        valueElement.style.height = '60px'; // 固定高度

        const valueNumber = document.createElement('span');
        valueNumber.textContent = value;
        valueElement.appendChild(valueNumber);

        if (unit) {
            const unitSpan = document.createElement('span');
            unitSpan.style.fontSize = '20px';
            unitSpan.style.marginLeft = '3px';
            unitSpan.textContent = unit;
            valueElement.appendChild(unitSpan);
        }

        const labelElement = document.createElement('div');
        labelElement.style.fontSize = '16px';
        labelElement.style.marginTop = '5px';
        labelElement.textContent = label;

        container.appendChild(valueElement);
        container.appendChild(labelElement);

        return container;
    }

    // 更新预览
    function updatePreview() {
        const preview = document.querySelector('.strava-export-preview');

        // 更新路线颜色
        const pathElement = preview.querySelector('svg path');
        if (pathElement) {
            pathElement.setAttribute('stroke', currentRouteColor);
        }
    }

    // 导出图片
    function exportImage(element, callback) {
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

            if (callback) {
                callback();
            }
        });
    }
})();