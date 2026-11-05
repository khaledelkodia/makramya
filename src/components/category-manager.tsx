"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { removeCategoryImage, saveCategoryDetails, saveCategoryImage } from "@/app/actions";
import type { StoreCategory } from "@/lib/categories";
import { categoryFallbackImages } from "@/lib/store-images";

type Message={text:string;error:boolean};

export function CategoryManager({categories,setupMessage}:{categories:StoreCategory[];setupMessage?:string}){
  const router=useRouter();
  const [busy,startTransition]=useTransition();
  const [imageMessages,setImageMessages]=useState<Record<string,Message>>({});
  const [detailsMessages,setDetailsMessages]=useState<Record<string,Message>>({});

  function saveDetails(slug:string,event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const formData=new FormData(event.currentTarget);
    startTransition(async()=>{
      const result=await saveCategoryDetails(formData);
      setDetailsMessages(current=>({...current,[slug]:{text:result.ok?"اتحفظت بيانات الصنف.":result.error||"تعذر حفظ البيانات.",error:!result.ok}}));
      if(result.ok)router.refresh();
    });
  }

  function uploadImage(slug:string,event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const formData=new FormData(event.currentTarget);
    startTransition(async()=>{
      const result=await saveCategoryImage(formData);
      setImageMessages(current=>({...current,[slug]:{text:result.ok?(result.warning||"اتحفظت صورة الصنف."):result.error||"تعذر حفظ الصورة.",error:!result.ok}}));
      if(result.ok)router.refresh();
    });
  }

  function removeImage(category:StoreCategory){
    if(!window.confirm(`تحبي تشيلي صورة «${category.name}»؟`))return;
    startTransition(async()=>{
      const result=await removeCategoryImage(category.slug);
      setImageMessages(current=>({...current,[category.slug]:{text:result.ok?(result.warning||"اتشالت صورة الصنف."):result.error||"تعذر حذف الصورة.",error:!result.ok}}));
      if(result.ok)router.refresh();
    });
  }

  return <>
    <div className="products-toolbar"><div><h2>إدارة الأصناف</h2><p>عدّلي اسم الصنف ووصفه وصورته الظاهرة في المتجر.</p></div></div>
    {setupMessage&&<div className="notice-box">{setupMessage}</div>}
    <div className="category-admin-grid">
      {categories.map(category=><article className="admin-card category-admin-card" key={category.slug}>
        <div className="category-admin-cover"><Image src={category.image_url||categoryFallbackImages[category.slug]} alt={category.name} fill sizes="(max-width: 640px) 100vw, 33vw"/></div>
        <div className="category-admin-info"><span className="eyebrow">{category.english}</span><h3>{category.name}</h3></div>
        <form key={`${category.slug}-${category.name}-${category.english}-${category.description}`} className="category-edit-form" onSubmit={event=>saveDetails(category.slug,event)}>
          <input type="hidden" name="slug" value={category.slug}/>
          <label>اسم الصنف<input name="name" defaultValue={category.name} minLength={2} maxLength={80} required/></label>
          <label>الاسم بالإنجليزية<input name="english" defaultValue={category.english} minLength={2} maxLength={60} required/></label>
          <label>وصف الصنف<textarea name="description" defaultValue={category.description} minLength={5} maxLength={300} rows={3} required/></label>
          <button className="button button-dark" disabled={busy}>{busy?<LoaderCircle className="spin" size={14}/>:<Check size={14}/>}حفظ التعديلات</button>
        </form>
        {detailsMessages[category.slug]&&<div className={`category-admin-message ${detailsMessages[category.slug].error?"error":"success"}`} role="status">{detailsMessages[category.slug].text}</div>}
        <form className="category-admin-actions" onSubmit={event=>uploadImage(category.slug,event)}>
          <input type="hidden" name="slug" value={category.slug}/>
          <label className="upload-field"><ImagePlus size={17}/><span>{category.image_url?"اختاري صورة بديلة":"اختاري صورة"}</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp" required/></label>
          <div className="category-image-actions"><button className="button button-dark" disabled={busy}>{busy?<LoaderCircle className="spin" size={14}/>:<Check size={14}/>}حفظ الصورة</button>{category.image_url&&<button type="button" className="category-image-remove" disabled={busy} onClick={()=>removeImage(category)} aria-label={`إزالة صورة ${category.name}`}><Trash2 size={14}/></button>}</div>
        </form>
        {imageMessages[category.slug]&&<div className={`category-admin-message ${imageMessages[category.slug].error?"error":"success"}`} role="status">{imageMessages[category.slug].text}</div>}
      </article>)}
    </div>
  </>;
}
