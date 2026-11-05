"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, ImagePlus, LoaderCircle, X } from "lucide-react";
import { updateProduct } from "@/app/actions";
import type { StoreCategory } from "@/lib/categories";
import type { Product } from "@/lib/types";

export function ProductEditForm({product,categories,onClose,onSaved,onError}:{product:Product;categories:Pick<StoreCategory,"slug"|"name">[];onClose:()=>void;onSaved:(message:string,warning?:boolean)=>void;onError:(message:string)=>void}){
  const [busy,setBusy]=useState(false);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);
    const result=await updateProduct(new FormData(event.currentTarget));
    setBusy(false);
    if(result.ok)onSaved(result.warning||"اتحفظت تعديلات المنتج.",Boolean(result.warning));
    else onError(result.error||"تعذر حفظ تعديلات المنتج.");
  }

  return <div className="modal-wrap open dashboard-modal-wrap" onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <form className="modal product-edit-modal" onSubmit={submit}>
      <button className="close-button" type="button" aria-label="إغلاق" onClick={onClose}><X/></button>
      <span className="eyebrow">تحديث التشكيلة</span>
      <h2>تعديل المنتج</h2>
      <p>عدّلي تفاصيل القطعة، ولو اخترتي صورة جديدة هتستبدل الحالية.</p>
      <input type="hidden" name="product_id" value={product.id}/>
      <div className="product-edit-current">
        {product.image_url&&<span className="product-edit-image"><Image src={product.image_url} alt={product.name} fill sizes="80px"/></span>}
        <span><b>{product.name}</b><small>{product.category}</small></span>
      </div>
      <div className="form-grid">
        <label>اسم المنتج<input name="name" defaultValue={product.name} minLength={2} maxLength={120} required/></label>
        <label>التصنيف<select name="category" defaultValue={product.category}>{!categories.some(category=>category.name===product.category)&&<option value={product.category}>{product.category}</option>}{categories.map(category=><option key={category.slug} value={category.name}>{category.name}</option>)}</select></label>
        <label>السعر بالجنيه<input name="price" type="number" min="1" step="1" defaultValue={product.price} required/></label>
        <label>نوع الصورة الفنية<select name="style_key" defaultValue={product.style_key}><option value="wall">مكرمية حائط</option><option value="curtain">ستارة</option><option value="decor">ديكور منزلي</option></select></label>
        <label>الألوان (افصلي بينهم بفاصلة)<input name="colors" defaultValue={product.colors.map(color=>color.name).join(", ")} required/></label>
        <label>المقاسات المتاحة (افصلي بينهم بفاصلة)<input name="sizes" defaultValue={product.sizes.join(", ")} required/></label>
        <label>عدد القطع<input name="inventory_count" type="number" min="0" defaultValue={product.inventory_count} required/></label>
        <label className="checkbox-field"><input name="track_inventory" type="checkbox" defaultChecked={product.track_inventory}/><span>تابعي المخزون وامتنعي عن قبول طلبات فوق المتاح</span></label>
        <label>علامة صغيرة (اختياري)<input name="badge" maxLength={60} defaultValue={product.badge||""} placeholder="جديد / الأكثر طلباً"/></label>
        <label className="full-field">وصف المنتج<textarea name="description" maxLength={2000} rows={3} defaultValue={product.description}/></label>
        <label className="upload-field full-field"><ImagePlus size={19}/><span>صورة جديدة · حتى 5 ميجابايت (اختياري)</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp"/></label>
      </div>
      <div className="product-edit-actions"><button className="button" type="button" onClick={onClose}>إلغاء</button><button className="button button-dark" disabled={busy}>{busy?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>}حفظ التعديلات</button></div>
    </form>
  </div>;
}
