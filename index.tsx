import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// Make SheetJS library available in the scope
declare const XLSX: any;

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ label, options, selectedOptions, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked ? options : []);
  };

  const handleOptionChange = (option: string) => {
    const newSelectedOptions = selectedOptions.includes(option)
      ? selectedOptions.filter(item => item !== option)
      : [...selectedOptions, option];
    onChange(newSelectedOptions);
  };
  
  const isAllSelected = options.length > 0 && selectedOptions.length === options.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="filter-control dropdown" ref={dropdownRef}>
      <label>{label}</label>
      <button className="dropdown-toggle" onClick={() => setIsOpen(!isOpen)} type="button">
        {selectedOptions.length === 0 ? `انتخاب ${label}` : `${selectedOptions.length} مورد انتخاب شده`}
      </button>
      {isOpen && (
        <div className="dropdown-list">
          <div className="dropdown-item select-all-item">
            <input
              type="checkbox"
              id={`select-all-${label}`}
              checked={isAllSelected}
              onChange={handleSelectAll}
            />
            <label htmlFor={`select-all-${label}`}>انتخاب همه</label>
          </div>
          {options.map(option => (
            <div className="dropdown-item" key={option}>
              <input
                type="checkbox"
                id={option}
                value={option}
                checked={selectedOptions.includes(option)}
                onChange={() => handleOptionChange(option)}
              />
              <label htmlFor={option}>{option}</label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const App = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [warehouseNames, setWarehouseNames] = useState<string[]>([]);
  const [productCodeMap, setProductCodeMap] = useState<Map<string, string>>(new Map());
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [calculationResult, setCalculationResult] = useState<number | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{ products: string[], warehouses: string[] } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setMessage(null);
    setData([]);
    setProductNames([]);
    setWarehouseNames([]);
    setProductCodeMap(new Map());
    setSelectedProducts([]);
    setSelectedWarehouses([]);
    setCalculationResult(null);
    setAppliedFilters(null);
     if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleFileSelected = (file: File | null) => {
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
        setSelectedFile(file);
        resetState();
      } else {
        setSelectedFile(null);
        resetState();
        setMessage({ text: 'لطفا یک فایل اکسل معتبر (xlsx یا xls) انتخاب کنید.', type: 'error' });
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelected(event.target.files?.[0] || null);
  };
  
  const handleRemoveFile = () => {
    setSelectedFile(null);
    resetState();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0] || null;
    handleFileSelected(file);
    if (file && fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
    }
  };

  const handleProcessFile = () => {
    if (!selectedFile) return;

    setIsLoading(true);
    resetState();
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const fileData = e.target?.result;
        const workbook = XLSX.read(fileData, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const requiredColumns = ['نام کالا', 'نام انبار', 'کد کالا', 'مقدار سند انبار', 'عنوان الگوی سند انبار'];
        if (jsonData.length > 0) {
            const firstRow = jsonData[0];
            for (const col of requiredColumns) {
                if (!(col in firstRow)) {
                     throw new Error(`ستون ضروری "${col}" یافت نشد.`);
                }
            }
        }

        setData(jsonData);
        
        const productCodeMapInstance = new Map<string, string>();
        jsonData.forEach((row: any) => {
            const productName = row['نام کالا'];
            const productCode = row['کد کالا'];
            if (productName && productCode && !productCodeMapInstance.has(productName)) {
                productCodeMapInstance.set(productName, String(productCode));
            }
        });
        setProductCodeMap(productCodeMapInstance);

        const products: string[] = Array.from(new Set(jsonData.map((row: any) => row['نام کالا']).filter(Boolean)));
        const warehouses: string[] = Array.from(new Set(jsonData.map((row: any) => row['نام انبار']).filter(Boolean)));

        setProductNames(products.sort());
        setWarehouseNames(warehouses.sort());
        
        setIsLoading(false);
        setMessage({ text: 'فایل با موفقیت پردازش شد. لطفا فیلترهای مورد نظر را انتخاب کنید.', type: 'success' });
      } catch (error: any) {
        console.error("Error processing file:", error);
        setIsLoading(false);
        setMessage({ text: `خطایی در پردازش فایل رخ داد: ${error.message}`, type: 'error' });
      }
    };

    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      setIsLoading(false);
      setMessage({ text: 'خطایی در خواندن فایل رخ داد.', type: 'error' });
    };

    reader.readAsBinaryString(selectedFile);
  };

  const handleFilterAndCalculate = () => {
    setCalculationResult(null);
    let currentFilteredData = data;

    if (selectedProducts.length > 0) {
      currentFilteredData = currentFilteredData.filter(row => selectedProducts.includes(row['نام کالا']));
    }

    if (selectedWarehouses.length > 0) {
      currentFilteredData = currentFilteredData.filter(row => selectedWarehouses.includes(row['نام انبار']));
    }

    setAppliedFilters({ products: selectedProducts, warehouses: selectedWarehouses });

    if (currentFilteredData.length === 0) {
      setMessage({ text: 'داده‌ای مطابق با فیلتر شما برای محاسبه وجود ندارد.', type: 'error' });
      return;
    }

    const total = currentFilteredData.reduce((sum, row) => {
      const value = parseFloat(row['مقدار سند انبار']);
      const type = row['عنوان الگوی سند انبار'];
      const validValue = isNaN(value) ? 0 : value;

      if (type === 'خرید داخلی' || type === 'رسید انتقال بین انبار') {
        return sum + validValue;
      }
      if (type === 'حواله انتقال بین انبار') {
        return sum - validValue;
      }
      return sum;
    }, 0);

    setCalculationResult(total);
    setMessage({ text: `فیلتر و محاسبه با موفقیت انجام شد. ${currentFilteredData.length} رکورد مطابق با فیلتر شما یافت شد.`, type: 'success' });
  };
  
  const generateResultTitle = () => {
      if (!appliedFilters) return "نتیجه محاسبه";
      
      const productText = appliedFilters.products.length > 0
          ? appliedFilters.products.length === 1 ? appliedFilters.products[0] : `${appliedFilters.products.length} کالای انتخابی`
          : 'همه کالاها';
          
      const warehouseText = appliedFilters.warehouses.length > 0
          ? appliedFilters.warehouses.length === 1 
            ? appliedFilters.warehouses[0].replace('انبار عمومی ', '').trim()
            : `${appliedFilters.warehouses.length} انبار انتخابی`
          : 'همه انبارها';

      return `تعداد موجودی کالای ${productText} در پروژه ${warehouseText}`;
  };


  return (
    <div className="container">
      <header className="header">
        <h1>سامانه هوشمند مدیریت موجودی کالا شرکت پایاسازه پاسارگاد</h1>
        <p>لطفا فایل اکسل گزارش راهکاران را بارگذاری نمایید.</p>
      </header>

      <div className="upload-section">
        <div
          className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            id="file-upload"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="upload-icon">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p>فایل اکسل خود را اینجا بکشید و رها کنید یا برای انتخاب کلیک کنید</p>
        </div>
        
        {selectedFile && (
          <div className="file-info">
            <span>{`فایل انتخاب شده: ${selectedFile.name}`}</span>
          </div>
        )}
      </div>

      <div className="action-buttons-container">
          <button
            className="process-button"
            onClick={handleProcessFile}
            disabled={!selectedFile || isLoading}
          >
             {isLoading ? <div className="spinner"></div> : 'پردازش فایل'}
          </button>
          {selectedFile && (
            <button className="remove-file-button" onClick={handleRemoveFile} title="حذف فایل">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
      </div>
      
      {message && (
        <div className={`message-section ${message.type} show`}>
          {message.text}
        </div>
      )}

      {productNames.length > 0 && warehouseNames.length > 0 && (
        <div className="filter-container">
          <div className="filter-section">
            <MultiSelectDropdown
                label="نام انبار"
                options={warehouseNames}
                selectedOptions={selectedWarehouses}
                onChange={setSelectedWarehouses}
            />
            <MultiSelectDropdown
                label="نام کالا"
                options={productNames}
                selectedOptions={selectedProducts}
                onChange={setSelectedProducts}
            />
          </div>
          <button 
            className="apply-filter-button"
            onClick={handleFilterAndCalculate}
          >
            اعمال فیلتر و محاسبه موجودی
          </button>
        </div>
      )}

      {appliedFilters && (
         <div className="applied-filters-summary">
            <h3>فیلترهای انتخاب شده برای محاسبه:</h3>
            <p>
                <strong>نام انبار:</strong> 
                {appliedFilters.warehouses.length > 0 ? appliedFilters.warehouses.join('، ') : 'همه انبارها'}
            </p>
            <p>
                <strong>نام کالا:</strong> 
                {appliedFilters.products.length > 0 
                    ? appliedFilters.products.map(name => `${name} (کد: ${productCodeMap.get(name) || 'N/A'})`).join('، ') 
                    : 'همه کالاها'}
            </p>
        </div>
      )}
      
      {calculationResult !== null && (
        <div className="result-container">
            <h2>{generateResultTitle()}</h2>
            <div className="result-box">
                {calculationResult.toLocaleString('fa-IR')}
            </div>
        </div>
      )}
      
      <footer className="footer">
        <p>اپلیکشن مدیریت موجودی توسط واحد انبار و اموال تهیه شده است</p>
      </footer>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);